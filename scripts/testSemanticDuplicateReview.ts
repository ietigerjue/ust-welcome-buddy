import fs from "node:fs/promises";
import path from "node:path";
import {
  reviewSemanticDuplicates,
  type SemanticDuplicateCandidate,
} from "../src/lib/semanticDuplicateReview";

const TEST_TEXT = [
  "HKUST freshman housing and dorm preparation guide.",
  "Before moving into student housing, prepare bedding, power adapters, personal documents, and daily essentials.",
  "New students should check official housing instructions, move-in arrangements, and hall notices before arrival.",
  "宿舍入住前建议准备床上用品、转换插头、证件、日用品，并留意学校和宿舍官方通知。",
].join("\n");

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

function assertRequiredConfig() {
  const requiredEnv = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "EMBEDDING_PROVIDER",
    "EMBEDDING_API_KEY",
    "EMBEDDING_BASE_URL",
    "EMBEDDING_MODEL",
    "EMBEDDING_DIMENSIONS",
  ];
  const missing = requiredEnv.filter((name) => !process.env[name]?.trim());

  console.log("[test:semantic-dedupe] config:", {
    SUPABASE_URL_exists: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY_exists: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY_exists: Boolean(process.env.EMBEDDING_API_KEY),
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS,
    SEMANTIC_DUPLICATE_THRESHOLD:
      process.env.SEMANTIC_DUPLICATE_THRESHOLD ?? "0.82",
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration for semantic duplicate review: ${missing.join(", ")}`
    );
  }
}

function printCandidate(candidate: SemanticDuplicateCandidate, index: number) {
  console.log(`\n[test:semantic-dedupe] candidate ${index + 1}:`, {
    title: candidate.title,
    category: candidate.category,
    source_type: candidate.source_type,
    similarity: candidate.similarity,
    preview: candidate.matched_chunk_preview,
  });
}

async function main() {
  await loadLocalEnv();
  assertRequiredConfig();

  console.log("[test:semantic-dedupe] test text length:", TEST_TEXT.length);

  const review = await reviewSemanticDuplicates({
    content: TEST_TEXT,
    maxCandidates: 10,
  });

  console.log("[test:semantic-dedupe] summary:", {
    hasPotentialDuplicates: review.hasPotentialDuplicates,
    threshold: review.threshold,
    candidates: review.candidates.length,
  });

  review.candidates.forEach(printCandidate);
}

main().catch((error) => {
  const details = getErrorDetails(error);

  console.error("[test:semantic-dedupe] failed:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });

  process.exitCode = 1;
});
