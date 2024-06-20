import crypto from "crypto";

const tokenSecret = process.env.TOKEN_SECRET as string;

export function hashString(
	value: string,
	algorithm: "sha256" | "sha512" | "sha1" = "sha256",
	encoding: crypto.BinaryToTextEncoding = "hex"
): string {
	const originalHash = crypto
		.createHmac(algorithm, tokenSecret)
		.update(value)
		.digest(encoding);
	return originalHash;
}
