import { createFileRoute } from "@tanstack/react-router";
import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const DEFAULT_MAX_CHUNKS = 20;
const MAX_CHUNKS_PER_REQUEST = 50;
const MAX_TEXT_LENGTH = 3000;
const RETRY_DELAYS_MS = [1000, 3000] as const;

type EmbedChunksPayload = {
  documentId?: unknown;
  maxChunks?: unknown;
};

type ChunkRow = {
  id: string;
  document_id: string;
  content: string | null;
};

type EmbedChunksResponse =
  | {
      documentId?: string;
      total: number;
      processed: number;
      success: number;
      failed: number;
      skipped: number;
      failedChunkIds: string[];
    }
  | {
      error: string;
    };

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function json(data: EmbedChunksResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAuthorized(request: Request) {
  const expectedToken = getEnv("ADMIN_IMPORT_TOKEN");
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

function getString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function getMaxChunks(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : DEFAULT_MAX_CHUNKS;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_CHUNKS;
  }

  return Math.min(Math.floor(parsed), MAX_CHUNKS_PER_REQUEST);
}

function truncateForEmbedding(text: string) {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function embedWithRetry(text: string) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      const isFinalAttempt = attempt === RETRY_DELAYS_MS.length;

      console.error("[admin/embed-chunks] embedding attempt failed:", {
        attempt: attempt + 1,
        final: isFinalAttempt,
        message: getErrorMessage(error),
      });

      if (isFinalAttempt) {
        throw error;
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new Error("Embedding generation failed.");
}

export const Route = createFileRoute("/api/admin/embed-chunks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as EmbedChunksPayload;
        const documentId = getString(body.documentId);
        const maxChunks = getMaxChunks(body.maxChunks);
        const supabase = getSupabaseServerClient();

        if (!supabase) {
          return json(
            { error: "Supabase server client is not configured." },
            { status: 500 }
          );
        }

        let query = supabase
          .from("document_chunks")
          .select("id, document_id, content")
          .is("embedding", null)
          .order("created_at", { ascending: true })
          .limit(maxChunks);

        if (documentId) {
          query = query.eq("document_id", documentId);
        }

        const { data, error } = await query;

        if (error) {
          return json({ error: error.message }, { status: 500 });
        }

        const chunks = (data ?? []) as ChunkRow[];
        let success = 0;
        let failed = 0;
        let skipped = 0;
        const failedChunkIds: string[] = [];

        for (const chunk of chunks) {
          const originalText = chunk.content?.trim() ?? "";

          if (!originalText) {
            skipped += 1;
            continue;
          }

          try {
            const embedding = await embedWithRetry(truncateForEmbedding(originalText));
            const { error: updateError } = await supabase
              .from("document_chunks")
              .update({ embedding })
              .eq("id", chunk.id);

            if (updateError) {
              throw new Error(updateError.message);
            }

            success += 1;
          } catch (chunkError) {
            failed += 1;
            failedChunkIds.push(chunk.id);
            console.error("[admin/embed-chunks] chunk failed:", {
              chunkId: chunk.id,
              documentId: chunk.document_id,
              message: getErrorMessage(chunkError),
            });
          }
        }

        return json({
          documentId: documentId || undefined,
          total: chunks.length,
          processed: success + failed + skipped,
          success,
          failed,
          skipped,
          failedChunkIds,
        });
      },
    },
  },
});
