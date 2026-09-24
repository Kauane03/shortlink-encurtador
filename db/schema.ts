import {
	bigserial,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

/**
 * Schema equivalente à tabela links do PostgreSQL.
 * A restrição unique é a garantia de unicidade usada pelo controller para
 * detectar colisões concorrentes entre requisições ou instâncias da API.
 */
export const links = pgTable("links", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	shortCode: varchar("short_code", { length: 32 }).notNull().unique(),
	originalUrl: text("original_url").notNull(),
	createdAt: timestamp("created_at", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;