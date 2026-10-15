import "dotenv/config";
import { z } from "zod";

/**
 * As variáveis de ambiente são validadas uma única vez na inicialização.
 * Se alguma réplica subir com configuração inválida, ela falha imediatamente
 * em vez de aceitar tráfego e quebrar no meio de uma requisição.
 */
const envSchema = z.object({
	PORT: z.coerce.number().int().positive().max(65535).default(3000),
	DATABASE_URL: z.string().optional(),
	REDIS_URL: z.string().default("redis://localhost:6379"),
	CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
	PG_POOL_MAX: z.coerce.number().int().positive().default(10),
	BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error("Variáveis de ambiente inválidas:", z.flattenError(result.error).fieldErrors);
	process.exit(1);
}

const parsed = result.data;

/**
 * O BASE_URL define o domínio público dos links curtos. Ele não pode vir do
 * header Host, que é controlado pelo cliente e muda atrás de um balanceador.
 */
export const env = {
	...parsed,
	BASE_URL: (parsed.BASE_URL ?? `http://localhost:${parsed.PORT}`).replace(/\/+$/, ""),
};

export function setRuntimePort(port: number): void {
	env.PORT = port;

	if (!parsed.BASE_URL) {
		env.BASE_URL = `http://localhost:${port}`;
	}
}
