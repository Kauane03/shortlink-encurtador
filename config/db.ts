import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";

/**
 * O pool reutiliza conexões com o PostgreSQL, evitando abrir uma conexão nova
 * a cada requisição. Em uma arquitetura distribuída, cada instância da API
 * mantém apenas seu próprio pool e o banco continua sendo o armazenamento
 * compartilhado e consistente entre todas as instâncias.
 */
export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	host: process.env.PGHOST,
	port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
	database: process.env.PGDATABASE,
	user: process.env.PGUSER,
	password: process.env.PGPASSWORD,
	max: process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : 10,
});

/** Instância do Drizzle usando o pool compartilhado do PostgreSQL. */
export const db = drizzle(pool, { schema });
