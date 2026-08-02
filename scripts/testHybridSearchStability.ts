import fs from "node:fs/promises";
import path from "node:path";
import { searchHybridKnowledgeBase } from "../src/lib/hybridSearch";

const DEFAULT_QUESTION = "宿舍入住前要准备什么东西？";
const RUN_COUNT = 3;

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

function getResultKey(result: {
  chunk_id?: string;
  document_id?: string;
  id: string;
  content: string;
}) {
  if (result.chunk_id) {
    return result.chunk_id;
  }

  return `${result.document_id ?? result.id}:${result.content.slice(0, 80)}`;
}

function buildOrderSignature(
  results: Awaited<ReturnType<typeof searchHybridKnowledgeBase>>
) {
  return results.map(getResultKey).join(" > ");
}

async function main() {
  await loadLocalEnv();

  const question = process.argv.slice(2).join(" ").trim() || DEFAULT_QUESTION;
  const runs: Awaited<ReturnType<typeof searchHybridKnowledgeBase>>[] = [];

  console.log("[test:hybrid-stability] config:", {
    SUPABASE_URL_exists: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY_exists: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
    HTTPS_PROXY_exists: Boolean(process.env.HTTPS_PROXY),
    HTTP_PROXY_exists: Boolean(process.env.HTTP_PROXY),
  });
  console.log("[test:hybrid-stability] question:", question);

  for (let index = 0; index < RUN_COUNT; index += 1) {
    const results = await searchHybridKnowledgeBase(question);
    runs.push(results);

    console.log(`\n[test:hybrid-stability] run ${index + 1}:`, {
      returnedChunks: results.length,
      orderSignature: buildOrderSignature(results),
    });

    for (const [resultIndex, result] of results.entries()) {
      console.log(`  ${resultIndex + 1}.`, {
        title: result.title,
        document_id: result.document_id,
        chunk_id: result.chunk_id,
        chunk_index: result.chunk_index,
        finalScore: result.finalScore,
        keywordScore: result.score,
        similarity: result.similarity,
      });
    }
  }

  const signatures = runs.map(buildOrderSignature);
  const firstSignature = signatures[0] ?? "";
  const stable = signatures.every((signature) => signature === firstSignature);

  console.log("\n[test:hybrid-stability] summary:", {
    runs: RUN_COUNT,
    stable,
    signatures,
  });

  if (!stable) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const details = getErrorDetails(error);

  console.error("[test:hybrid-stability] failed:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });

  process.exitCode = 1;
});
