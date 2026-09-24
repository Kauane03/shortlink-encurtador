import type { Request, Response } from "express";
import type { RedisClientType } from "redis";
import { pool } from "../config/db";
import { generateBase62 } from "../utils/base62";

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 3600);

type RedisClient = RedisClientType;

interface CreateLinkBody {
	url?: unknown;
}

/**
 * Cria um link curto. O controller não guarda estado de sessão em memória:
 * qualquer réplica da API pode receber a requisição, o que permite escalar
 * horizontalmente atrás de um balanceador sem afinidade de sessão.
 */
export async function createShortLink(
	request: Request<unknown, unknown, CreateLinkBody>,
	response: Response,
): Promise<void> {
	const { url } = request.body;

	if (typeof url !== "string" || !URL.canParse(url)) {
		response.status(400).json({ error: "Informe uma URL válida." });
		return;
	}

	/**
	 * O while resolve concorrência de forma segura: duas requisições podem
	 * gerar o mesmo código em instâncias diferentes, mas somente uma vence o
	 * INSERT UNIQUE. A outra recebe 23505, gera outro código e tenta novamente.
	 */
	while (true) {
		const code = generateBase62();

		try {
			await pool.query(
				"INSERT INTO links (short_code, original_url) VALUES ($1, $2)",
				[code, url],
			);

			/**
			 * O cache distribuído é preenchido depois da confirmação do banco. Assim
			 * uma réplica nunca publica no Redis um link que não foi persistido.
			 */
			const redis = request.app.locals.redis as RedisClient;
			await redis.set(`link:${code}`, url, { EX: CACHE_TTL_SECONDS });

			response.status(201).json({
				code,
				shortUrl: `${request.protocol}://${request.get("host")}/${code}`,
			});
			return;
		} catch (error: unknown) {
			const postgresError = error as { code?: string };

			if (postgresError.code === "23505") {
				continue;
			}

			throw error;
		}
	}
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
	const redis = request.app.locals.redis as RedisClient;
	const cacheKey = `link:${code}`;

	const cachedUrl = await redis.get(cacheKey);

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
	await redis.set(cacheKey, originalUrl, { EX: CACHE_TTL_SECONDS });
	response.redirect(302, originalUrl);
}
