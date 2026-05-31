import fs from "node:fs/promises";
import path from "node:path";
import { searchVectorKnowledgeBase } from "../src/lib/searchVectorKnowledgeBase";

const TEST_QUESTIONS = [
  "What should I prepare before moving into the dorm?",
  "我刚到香港，怎么去学校比较方便？",
  "Canvas 和 SIS 是什么？",
];

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

function previewContent(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function main() {
  await loadLocalEnv();
  const customQuestion = process.argv.slice(2).join(" ").trim();
  const questions = customQuestion ? [customQuestion] : TEST_QUESTIONS;

  console.log("[test:vector] config:", {
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

  for (const question of questions) {
    console.log("\n[test:vector] question:", question);

    const results = await searchVectorKnowledgeBase(question);

    console.log("[test:vector] returned chunks count:", results.length);

    for (const [index, result] of results.entries()) {
      console.log(`[test:vector] chunk ${index + 1}:`, {
        title: result.title,
        similarity: result.similarity,
        preview: previewContent(result.content),
      });
    }
  }
}

main().catch((error) => {
  const details = getErrorDetails(error);

  console.error("[test:vector] failed:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });

  process.exitCode = 1;
});
