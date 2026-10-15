import type { Request, Response } from "express";
import type { RedisClientType } from "redis";
import { pool } from "../config/db";
import { env } from "../config/env";
import { generateBase62 } from "../utils/base62";
import { shortCodeSchema, type CreateLinkInput } from "../validation/linkSchemas";

const MAX_INSERT_ATTEMPTS = 5;

type RedisClient = RedisClientType;

/**
 * O Redis é só uma otimização: se ele estiver fora do ar, a API continua
 * funcionando pelo PostgreSQL. Por isso falhas de cache são registradas e
 * ignoradas, nunca propagadas para o cliente.
 */
async function cacheGet(redis: RedisClient, key: string): Promise<string | null> {
	try {
		return await redis.get(key);
	} catch (error: unknown) {
		console.error("Falha ao ler do Redis:", error);
		return null;
	}
}

async function cacheSet(redis: RedisClient, key: string, value: string): Promise<void> {
	try {
		await redis.set(key, value, { EX: env.CACHE_TTL_SECONDS });
	} catch (error: unknown) {
		console.error("Falha ao gravar no Redis:", error);
	}
}

/**
 * Cria um link curto. O controller não guarda estado de sessão em memória:
 * qualquer réplica da API pode receber a requisição, o que permite escalar
 * horizontalmente atrás de um balanceador sem afinidade de sessão.
 * O body já chega validado pelo middleware validateBody(createLinkSchema).
 */
export async function createShortLink(
	request: Request<unknown, unknown, CreateLinkInput>,
	response: Response,
): Promise<void> {
	const { url } = request.body;

	/**
	 * O laço resolve concorrência de forma segura: duas requisições podem
	 * gerar o mesmo código em instâncias diferentes, mas somente uma vence o
	 * INSERT UNIQUE. A outra recebe 23505, gera outro código e tenta novamente.
	 * O número de tentativas é limitado para nunca prender a requisição.
	 */
	for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
		const code = generateBase62();

		try {
			await pool.query(
				"INSERT INTO links (short_code, original_url) VALUES ($1, $2)",
				[code, url],
			);
		} catch (error: unknown) {
			const postgresError = error as { code?: string };

			if (postgresError.code === "23505") {
				continue;
			}

			throw error;
		}

		/**
		 * O cache distribuído é preenchido depois da confirmação do banco. Assim
		 * uma réplica nunca publica no Redis um link que não foi persistido.
		 */
		const redis = request.app.locals.redis as RedisClient;
		await cacheSet(redis, `link:${code}`, url);

		response.status(201).json({
			code,
			shortUrl: `${env.BASE_URL}/${code}`,
		});
		return;
	}

	response.status(503).json({ error: "Não foi possível gerar um código único. Tente novamente." });
}

/**
 * Redireciona para a URL original. Primeiro consultamos o Redis, que é um
 * cache compartilhado entre réplicas e reduz a carga no PostgreSQL. Em cache
 * miss, buscamos no banco, repovoamos o cache com TTL e então respondemos 302.
 */
export async function redirectShortLink(
	request: Request<{ code: string }>,
	response: Response,
): Promise<void> {
	const { code } = request.params;

	/**
	 * Códigos fora do formato nunca existem no banco. Rejeitá-los aqui evita
	 * que requisições aleatórias (ex.: /favicon.ico) cheguem ao PostgreSQL.
	 */
	if (!shortCodeSchema.safeParse(code).success) {
		response.status(404).json({ error: "Link não encontrado." });
		return;
	}

	const redis = request.app.locals.redis as RedisClient;
	const cacheKey = `link:${code}`;

	const cachedUrl = await cacheGet(redis, cacheKey);

	if (cachedUrl) {
		response.redirect(302, cachedUrl);
		return;
	}

	const result = await pool.query<{ original_url: string }>(
		"SELECT original_url FROM links WHERE short_code = $1 LIMIT 1",
		[code],
	);

	if (result.rowCount === 0) {
		response.status(404).json({ error: "Link não encontrado." });
		return;
	}

	const originalUrl = result.rows[0].original_url;
	await cacheSet(redis, cacheKey, originalUrl);
	response.redirect(302, originalUrl);
}
