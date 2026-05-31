import { generateEmbedding } from "./embeddings";
import { getSupabaseServerClient } from "./supabaseServer";

const DEFAULT_MATCH_COUNT = 8;

type MatchDocumentChunkRow = {
  chunk_id?: unknown;
  id?: unknown;
  document_id?: unknown;
  content?: unknown;
  similarity?: unknown;
};

type DocumentMetadataRow = {
  id: string;
  slug: string | null;
  title: string | null;
  category: string | null;
  source: string | null;
  source_url: string | null;
  source_type: string | null;
  updated_at: string | null;
};

export type VectorKnowledgeChunk = {
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
};

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeMatchRow(row: MatchDocumentChunkRow) {
  const chunkId = getString(row.chunk_id) || getString(row.id);
  const documentId = getString(row.document_id);
  const content = getString(row.content);

  if (!chunkId || !documentId || !content) {
    return null;
  }

  return {
    chunk_id: chunkId,
    document_id: documentId,
    content,
    similarity: getNumber(row.similarity),
  };
}

function buildDocumentMap(documents: DocumentMetadataRow[]) {
  return new Map(
    documents.map((document) => [
      document.id,
      {
        title: document.title ?? "",
        slug: document.slug ?? "",
        category: document.category ?? "",
        source: document.source ?? "",
        source_url: document.source_url ?? "",
        source_type: document.source_type ?? "",
        updated_at: document.updated_at ?? "",
      },
    ])
  );
}

export async function searchVectorKnowledgeBase(
  question: string
): Promise<VectorKnowledgeChunk[]> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return [];
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    console.error("[vector-search] Supabase server client is not configured.");
    return [];
  }

  let queryEmbedding: number[];

  try {
    queryEmbedding = await generateEmbedding(trimmedQuestion);
  } catch (error) {
    console.error(
      "[vector-search] Failed to generate query embedding:",
      error instanceof Error ? error.message : error
    );
    return [];
  }

  const { data: matchRows, error: rpcError } = await supabase.rpc(
    "match_document_chunks",
    {
      query_embedding: queryEmbedding,
      match_count: DEFAULT_MATCH_COUNT,
    }
  );

  if (rpcError) {
    console.error("[vector-search] match_document_chunks RPC failed:", {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });
    return [];
  }

  const normalizedMatches = ((matchRows ?? []) as MatchDocumentChunkRow[])
    .map(normalizeMatchRow)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (normalizedMatches.length === 0) {
    return [];
  }

  const documentIds = Array.from(
    new Set(normalizedMatches.map((match) => match.document_id))
  );

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, title, slug, category, source, source_url, source_type, updated_at")
    .in("id", documentIds);

  if (documentsError) {
    console.error("[vector-search] Failed to load document metadata:", {
      message: documentsError.message,
      details: documentsError.details,
      hint: documentsError.hint,
      code: documentsError.code,
    });
    return [];
  }

  const documentMap = buildDocumentMap(
    (documents ?? []) as DocumentMetadataRow[]
  );

  return normalizedMatches.map((match) => {
    const metadata = documentMap.get(match.document_id);

    return {
      ...match,
      score: match.similarity,
      title: metadata?.title ?? "",
      slug: metadata?.slug ?? "",
      category: metadata?.category ?? "",
      source: metadata?.source ?? "",
      source_url: metadata?.source_url ?? "",
      source_type: metadata?.source_type ?? "",
      updated_at: metadata?.updated_at ?? "",
      retrieval_type: "vector",
    };
  });
}
