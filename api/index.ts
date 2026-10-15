import type { Request, Response } from "express";
import app from "../server";

export default function handler(request: Request, response: Response): void {
	const requestUrl = new URL(request.url ?? "/", "http://localhost");
	const expressPath = requestUrl.searchParams.get("__vercel_path");

	if (expressPath) {
		requestUrl.searchParams.delete("__vercel_path");
		request.url = `${expressPath}${requestUrl.search}`;
	}

	app(request, response);
}
