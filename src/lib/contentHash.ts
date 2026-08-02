import { createHash } from "node:crypto";

export function normalizeForHash(text: string) {
  return text
    .toLowerCase()
    .replace(/\r\n/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashContent(text: string) {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}
