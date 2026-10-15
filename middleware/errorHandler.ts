import type { NextFunction, Request, Response } from "express";

/**
 * Captura erros não tratados (o Express 5 já encaminha rejeições async para
 * cá) e responde sempre em JSON, sem expor detalhes internos ao cliente.
 */
export function errorHandler(
	error: unknown,
	_request: Request,
	response: Response,
	_next: NextFunction,
): void {
	const status = (error as { status?: number }).status;

	// Erros do próprio Express/body-parser (ex.: JSON malformado) trazem status 4xx.
	if (typeof status === "number" && status >= 400 && status < 500) {
		response.status(status).json({ error: "Requisição inválida." });
		return;
	}

	console.error("Erro não tratado:", error);
	response.status(500).json({ error: "Erro interno do servidor." });
}
