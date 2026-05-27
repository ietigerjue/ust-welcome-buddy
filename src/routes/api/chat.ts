import { createFileRoute } from "@tanstack/react-router";

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

function json(data: ChatResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getMiniMaxErrorMessage(answer: string) {
  const errorPrefixes = [
    "MiniMax 请求失败：",
    "MiniMax 配置缺失：",
    "MiniMax 没有返回有效回答",
  ];
  const matchedPrefix = errorPrefixes.find((prefix) =>
    answer.startsWith(prefix)
  );

  return matchedPrefix ? answer : undefined;
}

function getOptionalDocumentString(
  document: object,
  field: "document_id" | "slug" | "source_url" | "updated_at"
) {
  const value = (document as Partial<Record<typeof field, unknown>>)[field];

  return typeof value === "string" ? value : undefined;
}

function toChatSource(document: {
  id: string;
  title: string;
  content: string;
  source: string;
  updatedAt: string;
  category: string;
}): ChatSource {
  return {
    id: document.id,
    document_id: getOptionalDocumentString(document, "document_id"),
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
  try {
    const { searchSupabaseKnowledgeBase } = await import(
      "@/lib/searchSupabaseKnowledgeBase"
    );
    return await searchSupabaseKnowledgeBase(question);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Supabase search error";
    console.warn(
      `[UST Buddy] Supabase knowledge search failed. Falling back to local Markdown search: ${message}`
    );

    const { searchKnowledgeBase } = await import("@/lib/searchKnowledgeBase");
    return searchKnowledgeBase(question);
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logQuestion } = await import("@/lib/questionLogs");
        const body = await request.json().catch(() => null);
        const question = typeof body?.question === "string" ? body.question : "";
        const documents = await searchKnowledge(question);

        if (documents.length === 0) {
          await logQuestion({
            question,
            answerStatus: "not_covered",
          });

          return json({
            answer: "当前知识库没有覆盖这个问题。",
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

        await logQuestion({
          question,
          answerStatus: errorMessage ? "error" : "answered",
          matchedSources: dedupedSources,
          errorMessage,
        });

        return json({
          answer,
          sources: dedupedSources,
        });
      },
    },
  },
});
