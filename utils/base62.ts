import { randomBytes } from "node:crypto";

const BASE62_ALPHABET =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Gera um identificador curto usando bytes criptograficamente aleatórios.
 * A aleatoriedade reduz a chance de duas instâncias stateless escolherem o
 * mesmo código; ainda assim, a unicidade definitiva é garantida pelo índice
 * UNIQUE do PostgreSQL e pelo tratamento de colisão no controller.
 */
export function generateBase62(length = 7): string {
	const randomValues = randomBytes(length);

	return Array.from(randomValues, (value) =>
		BASE62_ALPHABET[value % BASE62_ALPHABET.length],
	).join("");
}
