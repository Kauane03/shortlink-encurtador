CREATE TABLE "links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"short_code" varchar(32) NOT NULL,
	"original_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_short_code_unique" UNIQUE("short_code")
);
