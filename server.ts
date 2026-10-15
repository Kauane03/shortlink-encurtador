import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createClient } from "redis";
import { env, setRuntimePort } from "./config/env";
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
let redisConnection: Promise<void> | undefined;

/**
 * O helmet adiciona headers de segurança (HSTS, X-Content-Type-Options,
 * Referrer-Policy, CSP etc.). Com Referrer-Policy: no-referrer, o site de
 * destino de um redirect não descobre de qual link curto o visitante veio.
 */
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(async (_request, _response, next) => {
	if (!redis.isReady) {
		if (!redisConnection) {
			redisConnection = redis
				.connect()
				.then(() => undefined)
				.catch((error: unknown) => {
					redisConnection = undefined;
					console.error("Não foi possível conectar ao Redis; usando PostgreSQL:", error);
				});
		}

		await redisConnection;
	}

	next();
});

/**
 * O POST cria o registro persistente; o GET usa cache distribuído e faz o
 * fallback para o banco. Nenhum estado de usuário fica preso nesta instância.
 */
app.post("/links", validateBody(createLinkSchema), createShortLink);
app.get("/:code", redirectShortLink);

app.use(errorHandler);

export default app;

function listenOnAvailablePort(port: number): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = app.listen(port);

		const onListening = (): void => {
			server.removeListener("error", onError);
			const address = server.address();

			if (!address || typeof address === "string") {
				reject(new Error("Não foi possível determinar a porta da API."));
				return;
			}

			resolve(address.port);
		};

		const onError = (error: NodeJS.ErrnoException): void => {
			server.removeListener("listening", onListening);

			if (error.code === "EADDRINUSE" && port < 65535) {
				console.warn(`A porta ${port} está ocupada; tentando a porta ${port + 1}.`);
				void listenOnAvailablePort(port + 1).then(resolve, reject);
				return;
			}

			reject(error);
		};

		server.once("listening", onListening);
		server.once("error", onError);
	});
}

async function startServer(): Promise<void> {
	const port = await listenOnAvailablePort(env.PORT);
	setRuntimePort(port);
	console.log(`API de encurtador ouvindo na porta ${port}`);
}

if (process.env.NODE_ENV !== "production") {
	startServer().catch((error: unknown) => {
		console.error("Não foi possível iniciar a API:", error);
		process.exitCode = 1;
	});
}
