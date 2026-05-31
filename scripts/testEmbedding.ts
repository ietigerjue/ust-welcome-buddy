import fs from "node:fs/promises";
import path from "node:path";
import { generateEmbedding } from "../src/lib/embeddings";

const TEST_TEXT = "HKUST freshman dorm preparation and campus life";
const DEFAULT_EMBEDDING_PROVIDER = "jina";
const DEFAULT_JINA_BASE_URL = "https://api.jina.ai/v1";

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: "cause" in error ? error.cause : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
    cause: undefined,
  };
}

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);

    try {
      const content = await fs.readFile(filePath, "utf8");

      for (const line of content.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
          continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");

        process.env[key] ??= value;
      }
    } catch (error) {
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!isMissingFile) {
        throw error;
      }
    }
  }
}

async function main() {
  await loadLocalEnv();

  const provider =
    process.env.EMBEDDING_PROVIDER?.trim() || DEFAULT_EMBEDDING_PROVIDER;
  const baseUrl =
    process.env.EMBEDDING_BASE_URL?.trim() ||
    (provider.toLowerCase() === "jina" ? DEFAULT_JINA_BASE_URL : undefined);

  console.log("[test:embedding] config:", {
    EMBEDDING_PROVIDER: provider,
    EMBEDDING_BASE_URL: baseUrl,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  });

  const embedding = await generateEmbedding(TEST_TEXT);

  console.log("[test:embedding] embedding length:", embedding.length);
}

main().catch((error) => {
  const details = getErrorDetails(error);

  console.error("[test:embedding] failed:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });

  process.exitCode = 1;
});
