import { createFileRoute } from "@tanstack/react-router";

const HYBRID_CONTEXT_LIMIT = 6;
const MAX_CONTEXT_CONTENT_LENGTH = 1200;
const KEYWORD_SCORE_WEIGHT = 0.5;
const VECTOR_SCORE_WEIGHT = 0.5;
const HYBRID_BONUS = 0.15;

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

type ContextDocument = {
  id: string;
  chunk_id?: string;
  document_id?: string;
  slug?: string;
  title: string;
  content: string;
  source: string;
  source_url?: string;
  updatedAt: string;
  updated_at?: string;
  category: string;
  keywords: string[];
  source_type?: string;
  retrieval_type?: string;
  score?: number;
  similarity?: number;
  hybridScore?: number;
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

function truncateContextContent(document: ContextDocument): ContextDocument {
  return {
    ...document,
    content: document.content.slice(0, MAX_CONTEXT_CONTENT_LENGTH),
  };
}

function getChunkKey(document: ContextDocument) {
  if (document.chunk_id) {
    return document.chunk_id;
  }

  const documentKey = document.document_id ?? document.id;
  return `${documentKey}:${document.content.slice(0, 80)}`;
}

function normalizeScore(value: number | undefined, maxValue: number) {
  if (!value || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

function toVectorContextDocument(document: {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
  score: number;
  title: string;
  slug: string;
  category: string;
  source: string;
  source_url: string;
  source_type: string;
  updated_at: string;
  retrieval_type: "vector";
}): ContextDocument {
  return {
    id: document.chunk_id,
    chunk_id: document.chunk_id,
    document_id: document.document_id,
    slug: document.slug,
    title: document.title,
    category: document.category,
    content: document.content,
    source: document.source,
    source_url: document.source_url,
    source_type: document.source_type,
    updatedAt: document.updated_at,
    updated_at: document.updated_at,
    keywords: [],
    retrieval_type: document.retrieval_type,
    score: document.score,
    similarity: document.similarity,
  };
}

function mergeHybridResults({
  keywordDocuments,
  vectorDocuments,
}: {
  keywordDocuments: ContextDocument[];
  vectorDocuments: ContextDocument[];
}) {
  const maxKeywordScore = Math.max(
    0,
    ...keywordDocuments.map((document) => document.score ?? 0)
  );
  const map = new Map<
    string,
    {
      document: ContextDocument;
      keywordScore?: number;
      vectorSimilarity?: number;
      hasKeyword: boolean;
      hasVector: boolean;
    }
  >();

  for (const document of keywordDocuments) {
    const key = getChunkKey(document);

    map.set(key, {
      document,
      keywordScore: document.score,
      hasKeyword: true,
      hasVector: false,
    });
  }

  for (const document of vectorDocuments) {
    const key = getChunkKey(document);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        document,
        vectorSimilarity: document.similarity,
        hasKeyword: false,
        hasVector: true,
      });
      continue;
    }

    existing.vectorSimilarity = document.similarity;
    existing.hasVector = true;

    existing.document = {
      ...document,
      ...existing.document,
      similarity: document.similarity,
      score: existing.keywordScore,
    };
  }

  return Array.from(map.values())
    .map((result) => {
      const hybridScore =
        normalizeScore(result.keywordScore, maxKeywordScore) *
          KEYWORD_SCORE_WEIGHT +
        (result.vectorSimilarity ?? 0) *
          VECTOR_SCORE_WEIGHT +
        (result.hasKeyword && result.hasVector ? HYBRID_BONUS : 0);

      return {
        ...result.document,
        score: result.keywordScore,
        similarity: result.vectorSimilarity,
        hybridScore,
      };
    })
    .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
    .slice(0, HYBRID_CONTEXT_LIMIT)
    .map(truncateContextContent);
}

async function searchKeywordKnowledge(question: string) {
  try {
    const { searchSupabaseKnowledgeBase } = await import(
      "@/lib/searchSupabaseKnowledgeBase"
    );
    return (await searchSupabaseKnowledgeBase(question)) as ContextDocument[];
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Supabase search error";
    console.warn(
      `[UST Buddy] Keyword knowledge search failed: ${message}`
    );
    return [];
  }
}

async function searchVectorKnowledge(question: string) {
  try {
    const { searchVectorKnowledgeBase } = await import(
      "@/lib/searchVectorKnowledgeBase"
    );
    const vectorDocuments = await searchVectorKnowledgeBase(question);
    return vectorDocuments.map(toVectorContextDocument);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown vector search error";
    console.warn(`[UST Buddy] Vector knowledge search failed: ${message}`);
    return [];
  }
}

async function searchKnowledge(question: string) {
  const [keywordDocuments, vectorDocuments] = await Promise.all([
    searchKeywordKnowledge(question),
    searchVectorKnowledge(question),
  ]);

  return mergeHybridResults({
    keywordDocuments,
    vectorDocuments,
  });
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
            retrievalMode: "hybrid",
            contextChunksCount: 0,
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
          retrievalMode: "hybrid",
          contextChunksCount: documents.length,
        });

        return json({
          answer,
          sources: dedupedSources,
        });
      },
    },
  },
});
