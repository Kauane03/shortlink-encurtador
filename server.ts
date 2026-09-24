import "dotenv/config";
import cors from "cors";
import express from "express";
import { createClient } from "redis";
import { createShortLink, redirectShortLink } from "./controllers/linkController";

const app = express();
const port = Number(process.env.PORT ?? 3000);

/**
 * O Redis é um serviço externo compartilhado, não um Map local. Isso mantém
 * o comportamento consistente quando várias instâncias stateless da API são
 * executadas em paralelo ou substituídas durante um deploy.
 */
const redis = createClient({
	url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redis.on("error", (error) => {
	console.error("Erro no Redis:", error);
});

app.locals.redis = redis;
app.use(cors());
app.use(express.json());

/**
 * O POST cria o registro persistente; o GET usa cache distribuído e faz o
 * fallback para o banco. Nenhum estado de usuário fica preso nesta instância.
 */
app.post("/links", createShortLink);
app.get("/:code", redirectShortLink);

async function startServer(): Promise<void> {
	await redis.connect();

	app.listen(port, () => {
		console.log(`API de encurtador ouvindo na porta ${port}`);
	});
}

startServer().catch((error: unknown) => {
	console.error("Não foi possível iniciar a API:", error);
	process.exitCode = 1;
});
