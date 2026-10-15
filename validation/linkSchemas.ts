import { z } from "zod";

/**
 * Só aceitamos http e https. Esquemas como javascript:, data: e file: seriam
 * válidos para URL.canParse, mas transformariam o encurtador em vetor de ataque.
 */
export const createLinkSchema = z.object({
	url: z.url({ protocol: /^https?$/, error: "Informe uma URL http ou https válida." }).max(2048),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

/** Formato exato produzido por generateBase62 (7 caracteres Base62). */
export const shortCodeSchema = z.string().regex(/^[0-9A-Za-z]{7}$/);
