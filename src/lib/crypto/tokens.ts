import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "@/lib/config";

const ALGO = "aes-256-gcm";

function keyBytes(): Buffer {
  const raw = config.tokenEncryptionKey;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is missing. Generate with: openssl rand -base64 32"
    );
  }
  // Accept base64 or any string; hash to 32 bytes
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(raw).digest();
}

/**
 * Blob layout: iv(12) | authTag(16) | ciphertext
 */
export function encryptToken(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptToken(blob: Buffer): string {
  if (blob.length < 28) throw new Error("Invalid encrypted token blob");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv(ALGO, keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

export function canEncrypt(): boolean {
  return Boolean(config.tokenEncryptionKey);
}
