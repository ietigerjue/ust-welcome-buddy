import { createFileRoute } from "@tanstack/react-router";
import type { HybridKnowledgeDocument as ContextDocument } from "@/lib/hybridSearch";

const RETRIEVAL_MODE = "hybrid";
const RAG_DEBUG_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DEBUG_CONTENT_PREVIEW_LENGTH = 200;

type ChatSource = {
  id: string;
  document_id?: string;
  slug?: string;
  title: string;
  snippet: string;
  source: string;
  source_url?: string;
  updatedAt: string;
  updated_at?: string;
  category: string;
  matchedChunksCount?: number;
};

type ChatResponse = {
  answer: string;
  sources: ChatSource[];
};

type ChatModelLogInfo = {
  modelProvider: string;
  modelName: string;
};

function json(data: ChatResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function isRagDebugEnabled() {
  const value = process.env.RAG_DEBUG?.trim().toLowerCase();

  return value ? RAG_DEBUG_ENABLED_VALUES.has(value) : false;
}

function getContentPreview(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, DEBUG_CONTENT_PREVIEW_LENGTH);
}

function logRetrievalDebug({
  question,
  documents,
}: {
  question: string;
  documents: ContextDocument[];
}) {
  if (!isRagDebugEnabled()) {
    return;
  }

  console.log("[RAG_DEBUG] retrieval summary", {
    question,
    retrievalMode: RETRIEVAL_MODE,
    topContextChunksCount: documents.length,
  });

  for (const [index, document] of documents.entries()) {
    console.log("[RAG_DEBUG] context chunk", {
      rank: index + 1,
      title: document.title,
      category: document.category,
      source_type: document.source_type,
      finalScore: document.finalScore ?? document.hybridScore,
      vectorSimilarity: document.similarity,
      keywordScore: document.score,
      contentPreview: getContentPreview(document.content),
    });
  }
}

function getMiniMaxErrorMessage(answer: string) {
  const errorPrefixes = [
    "MiniMax 请求失败：",
    "MiniMax 配置缺失：",
    "Provider is configured but required environment variable is missing.",
    "MiniMax 没有返回有效回答",
  ];
  const matchedPrefix = errorPrefixes.find((prefix) =>
    answer.startsWith(prefix)
  );

  return matchedPrefix ? answer : undefined;
}

function getOptionalDocumentString(
  document: object,
  field: "chunk_id" | "document_id" | "slug" | "source_url" | "updated_at"
) {
  const value = (document as Partial<Record<typeof field, unknown>>)[field];

  return typeof value === "string" ? value : undefined;
}

function toChatSource(document: ContextDocument): ChatSource {
  return {
    id: document.id,
    document_id:
      getOptionalDocumentString(document, "document_id") ??
      getOptionalDocumentString(document, "chunk_id"),
    slug: getOptionalDocumentString(document, "slug"),
    title: document.title,
    snippet: document.content,
    source: document.source,
    source_url: getOptionalDocumentString(document, "source_url"),
    updatedAt: document.updatedAt,
    updated_at: getOptionalDocumentString(document, "updated_at"),
    category: document.category,
  };
}

async function searchKnowledge(question: string) {
  const { searchHybridKnowledgeBase } = await import("@/lib/hybridSearch");
  return searchHybridKnowledgeBase(question);
}

async function getChatModelLogInfo(): Promise<ChatModelLogInfo> {
  try {
    const { getModelConfig } = await import("@/lib/appConfig");
    const config = await getModelConfig("chat_llm");

    return {
      modelProvider: config.provider || "unknown",
      modelName: config.model || process.env.MINIMAX_MODEL || "unknown",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown model config error";
    console.warn(`[UST Buddy] Failed to load chat model config: ${message}`);

    return {
      modelProvider:
        process.env.CHAT_LLM_PROVIDER || process.env.LLM_PROVIDER || "unknown",
      modelName:
        process.env.CHAT_LLM_MODEL || process.env.MINIMAX_MODEL || "unknown",
    };
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const { logQuestion } = await import("@/lib/questionLogs");
        const { estimateTokens } = await import("@/lib/tokenEstimate");
        const { buildAnswerTokenEstimateText } = await import("@/lib/llm");
        const body = await request.json().catch(() => null);
        const question = typeof body?.question === "string" ? body.question : "";
        const modelLogInfo = await getChatModelLogInfo();
        const documents = await searchKnowledge(question);
        logRetrievalDebug({ question, documents });

        if (documents.length === 0) {
          const answer = "当前知识库没有覆盖这个问题。";

          await logQuestion({
            question,
            answerStatus: "not_covered",
            retrievalMode: RETRIEVAL_MODE,
            contextChunksCount: 0,
            modelProvider: modelLogInfo.modelProvider,
            modelName: modelLogInfo.modelName,
            estimatedInputTokens: estimateTokens(
              buildAnswerTokenEstimateText({
                question,
                contextDocuments: [],
              })
            ),
            estimatedOutputTokens: estimateTokens(answer),
            latencyMs: Date.now() - startedAt,
          });

          return json({
            answer,
            sources: [],
          });
        }

        const { generateAnswer } = await import("@/lib/llm");
        const { dedupeSources } = await import("@/lib/dedupeSources");
        let answer: string;

        try {
          answer = await generateAnswer({
            question,
            contextDocuments: documents,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          answer = `MiniMax 请求失败：${message}`;
        }

        const errorMessage = getMiniMaxErrorMessage(answer);
        const dedupedSources = dedupeSources(documents.map(toChatSource));
        const estimatedInputTokens = estimateTokens(
          buildAnswerTokenEstimateText({
            question,
            contextDocuments: documents,
          })
        );

        await logQuestion({
          question,
          answerStatus: errorMessage ? "error" : "answered",
          matchedSources: dedupedSources,
          errorMessage,
          retrievalMode: RETRIEVAL_MODE,
          contextChunksCount: documents.length,
          modelProvider: modelLogInfo.modelProvider,
          modelName: modelLogInfo.modelName,
          estimatedInputTokens,
          estimatedOutputTokens: estimateTokens(answer),
          latencyMs: Date.now() - startedAt,
        });

        return json({
          answer,
          sources: dedupedSources,
        });
      },
    },
  },
});
