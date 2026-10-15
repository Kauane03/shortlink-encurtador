import type { Request, Response } from "express";
import app from "../server";

export default function handler(request: Request, response: Response): void {
	request.url = (request.url ?? "/").replace(/^\/api(?:\/index\.ts)?(?=\/|\?|$)/, "") || "/";
	app(request, response);
}
