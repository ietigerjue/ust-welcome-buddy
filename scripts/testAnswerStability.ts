import fs from "node:fs/promises";
import path from "node:path";
import { dedupeSources } from "../src/lib/dedupeSources";
import { searchHybridKnowledgeBase } from "../src/lib/hybridSearch";
import { generateAnswer } from "../src/lib/llm";

const TEST_QUESTIONS = [
  "宿舍或租房入住前要准备哪些事项？",
  "从香港机场怎么去港科？",
  "Canvas 和 SIS 是什么？",
];
const RUN_COUNT = 3;
const ANSWER_PREVIEW_LENGTH = 200;

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

function getContextChunkId(document: {
  chunk_id?: string;
  document_id?: string;
  id: string;
  content: string;
}) {
  if (document.chunk_id) {
    return document.chunk_id;
  }

  return `${document.document_id ?? document.id}:${document.content.slice(0, 80)}`;
}

function getAnswerPreview(answer: string) {
  return answer.replace(/\s+/g, " ").trim().slice(0, ANSWER_PREVIEW_LENGTH);
}

function getTopSourceTitles(
  documents: Awaited<ReturnType<typeof searchHybridKnowledgeBase>>
) {
  return dedupeSources(
    documents.map((document) => ({
      id: document.id,
      document_id: document.document_id ?? document.chunk_id,
      slug: document.slug,
      title: document.title,
      source: document.source,
      source_url: document.source_url,
      updatedAt: document.updatedAt,
      updated_at: document.updated_at,
      category: document.category,
    }))
  ).map((source) => source.title);
}

function arraysMatch(a: string[], b: string[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function runQuestion(question: string) {
  const runs: Array<{
    topSourceTitles: string[];
    contextChunkIds: string[];
    answerPreview: string;
  }> = [];

  console.log("\n[test:answer-stability] question:", question);

  for (let index = 0; index < RUN_COUNT; index += 1) {
    const contextDocuments = await searchHybridKnowledgeBase(question);
    const answer =
      contextDocuments.length === 0
        ? "当前知识库没有覆盖这个问题。"
        : await generateAnswer({ question, contextDocuments });
    const topSourceTitles = getTopSourceTitles(contextDocuments);
    const contextChunkIds = contextDocuments.map(getContextChunkId);
    const answerPreview = getAnswerPreview(answer);

    runs.push({
      topSourceTitles,
      contextChunkIds,
      answerPreview,
    });

    console.log(`[test:answer-stability] run ${index + 1}:`, {
      topSourceTitles,
      contextChunkIds,
      answerPreview,
    });
  }

  const firstRun = runs[0];
  const topSourceTitlesStable = runs.every((run) =>
    arraysMatch(run.topSourceTitles, firstRun.topSourceTitles)
  );
  const contextChunkIdsStable = runs.every((run) =>
    arraysMatch(run.contextChunkIds, firstRun.contextChunkIds)
  );

  console.log("[test:answer-stability] question summary:", {
    topSourceTitlesStable,
    contextChunkIdsStable,
  });

  return {
    question,
    topSourceTitlesStable,
    contextChunkIdsStable,
  };
}

async function main() {
  await loadLocalEnv();

  console.log("[test:answer-stability] config:", {
    SUPABASE_URL_exists: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY_exists: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    MINIMAX_BASE_URL_exists: Boolean(process.env.MINIMAX_BASE_URL),
    MINIMAX_MODEL: process.env.MINIMAX_MODEL,
    MINIMAX_API_KEY_exists: Boolean(process.env.MINIMAX_API_KEY),
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  });

  const summaries = [];

  for (const question of TEST_QUESTIONS) {
    summaries.push(await runQuestion(question));
  }

  const failedQuestions = summaries.filter(
    (summary) =>
      !summary.topSourceTitlesStable || !summary.contextChunkIdsStable
  );

  console.log("\n[test:answer-stability] summary:", {
    totalQuestions: summaries.length,
    stableQuestions: summaries.length - failedQuestions.length,
    failedQuestions: failedQuestions.map((summary) => summary.question),
  });

  if (failedQuestions.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const details = getErrorDetails(error);

  console.error("[test:answer-stability] failed:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });

  process.exitCode = 1;
});
