import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const DEFAULT_THRESHOLD = 0.82;
const DEFAULT_MAX_CANDIDATES = 10;
const MAX_EMBEDDING_CONTENT_LENGTH = 4000;
const PREVIEW_LENGTH = 240;

export type SemanticDuplicateCandidate = {
  document_id: string;
  title: string;
  category: string;
  source: string;
  source_url: string;
  source_type: string;
  updated_at: string;
  similarity: number;
  matched_chunk_id: string;
  matched_chunk_preview: string;
  reason: string;
};

export type SemanticDuplicateReviewResult = {
  hasPotentialDuplicates: boolean;
  threshold: number;
  candidates: SemanticDuplicateCandidate[];
};

type ReviewInput = {
  content: string;
  excludeDocumentId?: string;
  threshold?: number;
  maxCandidates?: number;
};

type RpcDuplicateChunk = {
  chunk_id?: unknown;
  document_id?: unknown;
  content?: unknown;
  similarity?: unknown;
};

type DocumentMetadataRow = {
  id: string;
  title: string | null;
  category: string | null;
  source: string | null;
  source_url: string | null;
  source_type: string | null;
  updated_at: string | null;
};

function getEnvNumber(name: string, fallback: number) {
  const value = process.env[name]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function previewContent(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
}

function getReason(similarity: number) {
  if (similarity >= 0.88) {
    return "High-risk semantic overlap with an existing document.";
  }

  return "Potential semantic overlap with an existing document.";
}

function buildEmptyResult(threshold: number): SemanticDuplicateReviewResult {
  return {
    hasPotentialDuplicates: false,
    threshold,
    candidates: [],
  };
}

function normalizeRpcRows(rows: RpcDuplicateChunk[]) {
  return rows
    .map((row) => ({
      chunk_id: getString(row.chunk_id),
      document_id: getString(row.document_id),
      content: getString(row.content),
      similarity: getNumber(row.similarity),
    }))
    .filter(
      (row) =>
        row.chunk_id &&
        row.document_id &&
        row.content &&
        row.similarity > 0
    );
}

function keepTopChunkPerDocument(
  rows: ReturnType<typeof normalizeRpcRows>,
  excludeDocumentId?: string
) {
  const map = new Map<string, (typeof rows)[number]>();

  for (const row of rows) {
    if (excludeDocumentId && row.document_id === excludeDocumentId) {
      continue;
    }

    const existing = map.get(row.document_id);

    if (!existing || row.similarity > existing.similarity) {
      map.set(row.document_id, row);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.similarity - a.similarity
  );
}

function buildMetadataMap(documents: DocumentMetadataRow[]) {
  return new Map(
    documents.map((document) => [
      document.id,
      {
        title: document.title ?? "Untitled document",
        category: document.category ?? "",
        source: document.source ?? "",
        source_url: document.source_url ?? "",
        source_type: document.source_type ?? "",
        updated_at: document.updated_at ?? "",
      },
    ])
  );
}

export async function reviewSemanticDuplicates(
  input: ReviewInput
): Promise<SemanticDuplicateReviewResult> {
  const threshold =
    input.threshold ??
    getEnvNumber("SEMANTIC_DUPLICATE_THRESHOLD", DEFAULT_THRESHOLD);
  const maxCandidates = input.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const content = input.content.trim();

  if (!content) {
    return buildEmptyResult(threshold);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    console.error(
      "[semantic-duplicate-review] Supabase server client is not configured."
    );
    return buildEmptyResult(threshold);
  }

  let embedding: number[];

  try {
    embedding = await generateEmbedding(
      content.slice(0, MAX_EMBEDDING_CONTENT_LENGTH)
    );
  } catch (error) {
    console.error("[semantic-duplicate-review] Failed to generate embedding:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error,
      cause: error instanceof Error && "cause" in error ? error.cause : undefined,
    });
    return buildEmptyResult(threshold);
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "match_duplicate_chunks",
    {
      query_embedding: embedding,
      match_count: maxCandidates,
      similarity_threshold: threshold,
    }
  );

  if (rpcError) {
    console.error("[semantic-duplicate-review] RPC failed:", {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });
    return buildEmptyResult(threshold);
  }

  const topRows = keepTopChunkPerDocument(
    normalizeRpcRows((rpcRows ?? []) as RpcDuplicateChunk[]),
    input.excludeDocumentId
  ).slice(0, maxCandidates);

  if (topRows.length === 0) {
    return buildEmptyResult(threshold);
  }

  const documentIds = topRows.map((row) => row.document_id);
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select(
      "id, title, category, source, source_url, source_type, updated_at"
    )
    .in("id", documentIds);

  if (documentsError) {
    console.error("[semantic-duplicate-review] Failed to load documents:", {
      message: documentsError.message,
      details: documentsError.details,
      hint: documentsError.hint,
      code: documentsError.code,
    });
    return buildEmptyResult(threshold);
  }

  const metadataMap = buildMetadataMap((documents ?? []) as DocumentMetadataRow[]);
  const candidates = topRows.map((row) => {
    const metadata = metadataMap.get(row.document_id);

    return {
      document_id: row.document_id,
      title: metadata?.title ?? "Untitled document",
      category: metadata?.category ?? "",
      source: metadata?.source ?? "",
      source_url: metadata?.source_url ?? "",
      source_type: metadata?.source_type ?? "",
      updated_at: metadata?.updated_at ?? "",
      similarity: row.similarity,
      matched_chunk_id: row.chunk_id,
      matched_chunk_preview: previewContent(row.content),
      reason: getReason(row.similarity),
    };
  });

  return {
    hasPotentialDuplicates: candidates.length > 0,
    threshold,
    candidates,
  };
}
