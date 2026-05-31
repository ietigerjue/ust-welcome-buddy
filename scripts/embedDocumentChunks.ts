import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { Agent, ProxyAgent, setGlobalDispatcher } from "undici";
import { generateEmbedding } from "../src/lib/embeddings";

const BATCH_SIZE = 10;
const QUERY_PAGE_SIZE = 1000;
const MAX_TEXT_LENGTH = 3000;
const RETRY_DELAYS_MS = [1000, 3000, 6000] as const;
const EMBEDDING_CONNECT_TIMEOUT_MS = 30000;

type ChunkRow = {
  id: string;
  content: string | null;
};

type SupabaseClient = ReturnType<typeof createClient>;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function configureProxyDispatcher() {
  const httpsProxy = process.env.HTTPS_PROXY?.trim();
  const httpProxy = process.env.HTTP_PROXY?.trim();
  const proxyUrl = httpsProxy || httpProxy;

  if (proxyUrl) {
    setGlobalDispatcher(
      new ProxyAgent({
        uri: proxyUrl,
        connect: {
          timeout: EMBEDDING_CONNECT_TIMEOUT_MS,
        },
      })
    );

    console.log("[embed:chunks] proxy dispatcher enabled:", {
      proxyEnv: httpsProxy ? "HTTPS_PROXY" : "HTTP_PROXY",
      connectTimeoutMs: EMBEDDING_CONNECT_TIMEOUT_MS,
    });
    return;
  }

  setGlobalDispatcher(
    new Agent({
      connect: {
        timeout: EMBEDDING_CONNECT_TIMEOUT_MS,
      },
    })
  );
}

function truncateForEmbedding(text: string) {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

async function fetchPendingChunks(supabase: SupabaseClient) {
  const rows: ChunkRow[] = [];
  let from = 0;

  while (true) {
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("document_chunks")
      .select("id, content")
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to query document_chunks: ${error.message}`);
    }

    const pageRows = (data ?? []) as ChunkRow[];
    rows.push(...pageRows);

    if (pageRows.length < QUERY_PAGE_SIZE) {
      break;
    }

    from += QUERY_PAGE_SIZE;
  }

  return rows;
}

async function embedAndUpdateChunk({
  supabase,
  chunk,
}: {
  supabase: SupabaseClient;
  chunk: ChunkRow;
}) {
  const originalText = chunk.content?.trim() ?? "";

  if (!originalText) {
    throw new Error("Chunk content is empty.");
  }

  const embeddingText = truncateForEmbedding(originalText);

  console.log("[embed:chunks] chunk start:", {
    id: chunk.id,
    textLength: originalText.length,
    embeddingTextLength: embeddingText.length,
    truncated: originalText.length > embeddingText.length,
  });

  const embedding = await generateEmbedding(embeddingText);
  const { error: updateError } = await supabase
    .from("document_chunks")
    .update({ embedding })
    .eq("id", chunk.id);

  if (updateError) {
    throw new Error(`Failed to update embedding: ${updateError.message}`);
  }

  console.log("[embed:chunks] chunk success:", {
    id: chunk.id,
    embeddingLength: embedding.length,
  });
}

async function embedChunkWithRetry({
  supabase,
  chunk,
}: {
  supabase: SupabaseClient;
  chunk: ChunkRow;
}) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      if (attempt > 0) {
        console.log("[embed:chunks] retry chunk:", {
          id: chunk.id,
          attempt: attempt + 1,
        });
      }

      await embedAndUpdateChunk({ supabase, chunk });
      return;
    } catch (error) {
      const details = getErrorDetails(error);
      const isFinalAttempt = attempt === RETRY_DELAYS_MS.length;

      console.error("[embed:chunks] chunk failed:", {
        id: chunk.id,
        attempt: attempt + 1,
        final: isFinalAttempt,
        name: details.name,
        message: details.message,
        cause: details.cause,
      });

      if (isFinalAttempt) {
        throw error;
      }

      const delayMs = RETRY_DELAYS_MS[attempt];
      console.log("[embed:chunks] waiting before retry:", {
        id: chunk.id,
        delayMs,
      });
      await sleep(delayMs);
    }
  }
}

async function main() {
  await loadLocalEnv();
  configureProxyDispatcher();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local or your shell environment."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const pendingChunks = await fetchPendingChunks(supabase);
  const totalCount = pendingChunks.length;
  let successCount = 0;
  let failedCount = 0;
  const failedChunkIds: string[] = [];

  console.log("[embed:chunks] pending chunks:", {
    total: totalCount,
    batchSize: BATCH_SIZE,
    maxTextLength: MAX_TEXT_LENGTH,
  });

  for (let index = 0; index < pendingChunks.length; index += BATCH_SIZE) {
    const batch = pendingChunks.slice(index, index + BATCH_SIZE);

    console.log("[embed:chunks] processing batch:", {
      batchNumber: Math.floor(index / BATCH_SIZE) + 1,
      batchSize: batch.length,
      start: index + 1,
      end: index + batch.length,
      total: totalCount,
    });

    for (const chunk of batch) {
      try {
        await embedChunkWithRetry({ supabase, chunk });
        successCount += 1;
      } catch {
        failedCount += 1;
        failedChunkIds.push(chunk.id);
      }
    }
  }

  console.log("[embed:chunks] done:", {
    total: totalCount,
    success: successCount,
    failed: failedCount,
    failedChunkIds,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[embed:chunks] Failed:", message);
  process.exitCode = 1;
});
