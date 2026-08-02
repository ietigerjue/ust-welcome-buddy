import type { KnowledgeDocument } from "@/data/knowledgeBase";
import { hashContent } from "@/lib/contentHash";
import {
  searchSupabaseKnowledgeBase,
  type SupabaseKnowledgeDocument,
} from "@/lib/searchSupabaseKnowledgeBase";
import {
  searchVectorKnowledgeBase,
  type VectorKnowledgeChunk,
} from "@/lib/searchVectorKnowledgeBase";

const HYBRID_CONTEXT_LIMIT = 6;
const MAX_CONTEXT_CONTENT_LENGTH = 1200;
const KEYWORD_SCORE_WEIGHT = 0.5;
const VECTOR_SCORE_WEIGHT = 0.5;
const HYBRID_BONUS = 0.15;
const SCORE_TIE_EPSILON = 0.0001;

export type HybridKnowledgeDocument = KnowledgeDocument & {
  chunk_id?: string;
  document_id?: string;
  slug?: string;
  source_url?: string;
  updated_at?: string;
  source_type?: string;
  content_hash?: string;
  retrieval_type?: string;
  score?: number;
  similarity?: number;
  hybridScore?: number;
  finalScore?: number;
  matchedTerms?: string[];
  chunk_index?: number;
  chunkIndex?: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getStableDocumentId(document: HybridKnowledgeDocument) {
  return document.document_id ?? document.slug ?? document.id ?? "";
}

function getStableChunkId(document: HybridKnowledgeDocument) {
  return document.chunk_id ?? document.id ?? "";
}

function getStableChunkIndex(document: HybridKnowledgeDocument) {
  if (typeof document.chunk_index === "number") {
    return document.chunk_index;
  }

  if (typeof document.chunkIndex === "number") {
    return document.chunkIndex;
  }

  return 0;
}

function getChunkKey(document: HybridKnowledgeDocument) {
  if (document.chunk_id) {
    return document.chunk_id;
  }

  const documentKey = document.document_id ?? document.id;
  return `${documentKey}:${document.content.slice(0, 80)}`;
}

function getContentDedupeKey(document: HybridKnowledgeDocument) {
  return document.content_hash || hashContent(document.content);
}

function normalizeScore(value: number | undefined, maxValue: number) {
  if (!value || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

function compareTextAscending(a: string, b: string) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function compareHybridRank(
  a: HybridKnowledgeDocument,
  b: HybridKnowledgeDocument
) {
  const scoreDelta = (b.finalScore ?? 0) - (a.finalScore ?? 0);

  if (Math.abs(scoreDelta) > SCORE_TIE_EPSILON) {
    return scoreDelta;
  }

  const documentDelta = compareTextAscending(
    getStableDocumentId(a),
    getStableDocumentId(b)
  );

  if (documentDelta !== 0) {
    return documentDelta;
  }

  const chunkIndexDelta = getStableChunkIndex(a) - getStableChunkIndex(b);

  if (chunkIndexDelta !== 0) {
    return chunkIndexDelta;
  }

  return compareTextAscending(getStableChunkId(a), getStableChunkId(b));
}

function truncateContextContent(
  document: HybridKnowledgeDocument
): HybridKnowledgeDocument {
  return {
    ...document,
    content: document.content.slice(0, MAX_CONTEXT_CONTENT_LENGTH),
  };
}

function toKeywordContextDocument(
  document: SupabaseKnowledgeDocument
): HybridKnowledgeDocument {
  return {
    id: document.id,
    chunk_id: document.chunk_id,
    document_id: document.document_id,
    slug: document.slug,
    title: document.title,
    category: document.category,
    content: document.content,
    content_hash: document.content_hash,
    source: document.source,
    source_url: document.source_url,
    updatedAt: document.updatedAt,
    updated_at: document.updated_at,
    keywords: document.keywords,
    score: document.score,
    matchedTerms: document.matchedTerms,
    retrieval_type: "keyword",
    chunk_index: document.chunk_index,
    chunkIndex: document.chunkIndex,
  };
}

function toVectorContextDocument(
  document: VectorKnowledgeChunk
): HybridKnowledgeDocument {
  return {
    id: document.chunk_id,
    chunk_id: document.chunk_id,
    document_id: document.document_id,
    slug: document.slug,
    title: document.title,
    category: document.category,
    content: document.content,
    content_hash: document.content_hash,
    source: document.source,
    source_url: document.source_url,
    source_type: document.source_type,
    updatedAt: document.updated_at,
    updated_at: document.updated_at,
    keywords: [],
    retrieval_type: document.retrieval_type,
    score: document.score,
    similarity: document.similarity,
    chunk_index: document.chunk_index,
    chunkIndex: document.chunkIndex,
  };
}

export function mergeHybridResults({
  keywordDocuments,
  vectorDocuments,
}: {
  keywordDocuments: HybridKnowledgeDocument[];
  vectorDocuments: HybridKnowledgeDocument[];
}) {
  const maxKeywordScore = Math.max(
    0,
    ...keywordDocuments.map((document) => document.score ?? 0)
  );
  const map = new Map<
    string,
    {
      document: HybridKnowledgeDocument;
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
      source_type: existing.document.source_type || document.source_type,
      content_hash: existing.document.content_hash || document.content_hash,
      chunk_index:
        existing.document.chunk_index ?? document.chunk_index ?? 0,
      chunkIndex: existing.document.chunkIndex ?? document.chunkIndex ?? 0,
    };
  }

  return Array.from(map.values())
    .map((result) => {
      const finalScore =
        normalizeScore(result.keywordScore, maxKeywordScore) *
          KEYWORD_SCORE_WEIGHT +
        (result.vectorSimilarity ?? 0) *
          VECTOR_SCORE_WEIGHT +
        (result.hasKeyword && result.hasVector ? HYBRID_BONUS : 0);

      return {
        ...result.document,
        score: result.keywordScore,
        similarity: result.vectorSimilarity,
        finalScore,
        hybridScore: finalScore,
      };
    })
    .reduce<HybridKnowledgeDocument[]>((dedupedDocuments, document) => {
      const key = getContentDedupeKey(document);
      const existingIndex = dedupedDocuments.findIndex(
        (existingDocument) => getContentDedupeKey(existingDocument) === key
      );

      if (existingIndex === -1) {
        dedupedDocuments.push(document);
        return dedupedDocuments;
      }

      if (compareHybridRank(document, dedupedDocuments[existingIndex]) < 0) {
        dedupedDocuments[existingIndex] = document;
      }

      return dedupedDocuments;
    }, [])
    .sort(compareHybridRank)
    .slice(0, HYBRID_CONTEXT_LIMIT)
    .map(truncateContextContent);
}

async function searchKeywordKnowledge(question: string) {
  try {
    const documents = await searchSupabaseKnowledgeBase(question);
    return documents.map(toKeywordContextDocument);
  } catch (error) {
    console.warn(
      `[UST Buddy] Keyword knowledge search failed: ${getErrorMessage(error)}`
    );
    return [];
  }
}

async function searchVectorKnowledge(question: string) {
  try {
    const documents = await searchVectorKnowledgeBase(question);
    return documents.map(toVectorContextDocument);
  } catch (error) {
    console.warn(
      `[UST Buddy] Vector knowledge search failed: ${getErrorMessage(error)}`
    );
    return [];
  }
}

export async function searchHybridKnowledgeBase(question: string) {
  const [keywordDocuments, vectorDocuments] = await Promise.all([
    searchKeywordKnowledge(question),
    searchVectorKnowledge(question),
  ]);

  return mergeHybridResults({
    keywordDocuments,
    vectorDocuments,
  });
}
