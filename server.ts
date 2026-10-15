import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createClient } from "redis";
import { env } from "./config/env";
import { createShortLink, redirectShortLink } from "./controllers/linkController";
import { errorHandler } from "./middleware/errorHandler";
import { validateBody } from "./middleware/validateBody";
import { createLinkSchema } from "./validation/linkSchemas";

const app = express();

/**
 * O Redis é um serviço externo compartilhado, não um Map local. Isso mantém
 * o comportamento consistente quando várias instâncias stateless da API são
 * executadas em paralelo ou substituídas durante um deploy.
 */
const redis = createClient({
	url: env.REDIS_URL,
	// Com o Redis fora do ar, os comandos falham na hora em vez de esperar na
	// fila de reconexão; o controller então segue direto para o PostgreSQL.
	disableOfflineQueue: true,
});

redis.on("error", (error) => {
	console.error("Erro no Redis:", error);
});

app.locals.redis = redis;

/**
 * O helmet adiciona headers de segurança (HSTS, X-Content-Type-Options,
 * Referrer-Policy, CSP etc.). Com Referrer-Policy: no-referrer, o site de
 * destino de um redirect não descobre de qual link curto o visitante veio.
 */
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

/**
 * O POST cria o registro persistente; o GET usa cache distribuído e faz o
 * fallback para o banco. Nenhum estado de usuário fica preso nesta instância.
 */
app.post("/links", validateBody(createLinkSchema), createShortLink);
app.get("/:code", redirectShortLink);

app.use(errorHandler);

async function startServer(): Promise<void> {
	await redis.connect();

	app.listen(env.PORT, () => {
		console.log(`API de encurtador ouvindo na porta ${env.PORT}`);
	});
}

startServer().catch((error: unknown) => {
	console.error("Não foi possível iniciar a API:", error);
	process.exitCode = 1;
});
