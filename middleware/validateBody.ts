import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Valida o corpo da requisição com um schema zod. Em caso de sucesso, troca o
 * body pelos dados já validados, para o controller receber o tipo correto.
 */
export function validateBody(schema: z.ZodType) {
	return (request: Request, response: Response, next: NextFunction): void => {
		const result = schema.safeParse(request.body);

		if (!result.success) {
			response.status(400).json({
				error: "Dados inválidos.",
				issues: z.flattenError(result.error).fieldErrors,
			});
			return;
		}

		request.body = result.data;
		next();
	};
}
