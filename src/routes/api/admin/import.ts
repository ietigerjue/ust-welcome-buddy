import { createFileRoute } from "@tanstack/react-router";
import { hashContent } from "@/lib/contentHash";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const MIN_CHUNK_LENGTH = 800;
const MAX_CHUNK_LENGTH = 1000;

type ImportPayload = {
  title?: unknown;
  category?: unknown;
  source?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  updatedAt?: unknown;
  updated_at?: unknown;
  keywords?: unknown;
  summary?: unknown;
  content?: unknown;
};

type ImportResponse =
  | {
      documentId: string;
      slug: string;
      chunkCount: number;
      warnings?: string[];
    }
  | {
      error: string;
    };

function json(data: ImportResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function getAdminImportToken() {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.ADMIN_IMPORT_TOKEN;

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAuthorized(request: Request) {
  const expectedToken = getAdminImportToken();
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((keyword) => keyword.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
}

function hashString(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateSlug(title: string) {
  const readableSlug = slugify(title);
  const hash = hashString(title).slice(0, 8);

  if (!readableSlug) {
    return `doc-${hash}`;
  }

  return `${readableSlug}-${hash}`;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") {
    return "";
  }

  const text = value.trim();

  if (!text) {
    return "";
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toISOString().slice(0, 10);
}

function splitLongBlock(block: string) {
  const parts: string[] = [];
  let remaining = block.trim();

  while (remaining.length > MAX_CHUNK_LENGTH) {
    const slice = remaining.slice(0, MAX_CHUNK_LENGTH);
    const breakAt = Math.max(
      slice.lastIndexOf("。"),
      slice.lastIndexOf("."),
      slice.lastIndexOf("\n"),
      slice.lastIndexOf("；"),
      slice.lastIndexOf(";"),
      slice.lastIndexOf("，"),
      slice.lastIndexOf(",")
    );
    const endIndex =
      breakAt >= MIN_CHUNK_LENGTH ? breakAt + 1 : MAX_CHUNK_LENGTH;

    parts.push(remaining.slice(0, endIndex).trim());
    remaining = remaining.slice(endIndex).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function chunkContent(content: string) {
  const normalizedContent = content.replace(/\r\n/g, "\n").trim();

  if (!normalizedContent) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";
  const blocks = normalizedContent
    .split(/\n{2,}/)
    .flatMap((block) =>
      block.length > MAX_CHUNK_LENGTH ? splitLongBlock(block) : [block.trim()]
    )
    .filter(Boolean);

  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;

    if (next.length <= MAX_CHUNK_LENGTH) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    current = block;

    if (current.length >= MIN_CHUNK_LENGTH) {
      chunks.push(current);
      current = "";
    }
  }

  if (current) {
    if (chunks.length > 0 && current.length < MIN_CHUNK_LENGTH) {
      const previous = chunks.pop() ?? "";
      const merged = `${previous}\n\n${current}`.trim();

      if (merged.length <= MAX_CHUNK_LENGTH) {
        chunks.push(merged);
      } else {
        chunks.push(previous, current);
      }
    } else {
      chunks.push(current);
    }
  }

  return chunks;
}

function isUniqueConflict(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate key") ||
    error.message?.toLowerCase().includes("unique constraint")
  );
}

function isMissingContentHashColumn(error: { message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return message.includes("content_hash") && message.includes("schema cache");
}

function dedupeChunksByHash(chunks: string[]) {
  const seen = new Set<string>();
  const deduped: Array<{ content: string; contentHash: string }> = [];
  let skipped = 0;

  for (const chunk of chunks) {
    const contentHash = hashContent(chunk);

    if (seen.has(contentHash)) {
      skipped += 1;
      continue;
    }

    seen.add(contentHash);
    deduped.push({
      content: chunk,
      contentHash,
    });
  }

  return {
    chunks: deduped,
    skipped,
  };
}

export const Route = createFileRoute("/api/admin/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as
          | ImportPayload
          | null;

        if (!body) {
          return json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const title = getString(body.title);
        const category = getString(body.category);
        const content = getString(body.content);

        if (!title || !category || !content) {
          return json(
            { error: "Missing required fields: title, category, content." },
            { status: 400 }
          );
        }

        const supabase = getSupabaseServerClient();

        if (!supabase) {
          return json(
            { error: "Supabase server client is not configured." },
            { status: 500 }
          );
        }

        const source = getString(body.source) || null;
        const sourceUrl = getString(body.source_url) || null;
        const sourceType = getString(body.source_type) || "admin_import";
        const keywords = normalizeKeywords(body.keywords);
        const summary = getString(body.summary);
        const slug = generateSlug(title);
        const warnings: string[] = [];
        const documentContentHash = hashContent(content);
        const chunkDedupeResult = dedupeChunksByHash(chunkContent(content));
        const chunks = chunkDedupeResult.chunks;

        if (chunkDedupeResult.skipped > 0) {
          warnings.push(
            `Skipped ${chunkDedupeResult.skipped} duplicate chunks within this document.`
          );
        }

        const updatedAt =
          normalizeDate(body.updated_at) ||
          normalizeDate(body.updatedAt) ||
          getTodayDate();

        const { data: duplicateDocuments, error: duplicateCheckError } =
          await supabase
            .from("documents")
            .select("id, slug, title")
            .eq("content_hash", documentContentHash)
            .limit(1);

        if (duplicateCheckError) {
          if (isMissingContentHashColumn(duplicateCheckError)) {
            warnings.push(
              "Duplicate document check skipped because documents.content_hash is missing. Run supabase/deduplication.sql."
            );
          } else {
            warnings.push(
              `Could not check duplicate documents: ${duplicateCheckError.message}`
            );
          }
        } else if ((duplicateDocuments ?? []).length > 0) {
          warnings.push("A document with similar content already exists.");
        }

        const documentPayload = {
          slug,
          title,
          category,
          source,
          source_url: sourceUrl,
          source_type: sourceType,
          status: "ready",
          updated_at: updatedAt,
          content_hash: documentContentHash,
        };

        let { data: upsertedDocument, error: documentError } = await supabase
          .from("documents")
          .upsert(documentPayload, {
            onConflict: "slug",
          })
          .select("id")
          .single();

        if (documentError && isMissingContentHashColumn(documentError)) {
          warnings.push(
            "Imported without documents.content_hash because the column is missing. Run supabase/deduplication.sql."
          );

          const { content_hash: _contentHash, ...legacyDocumentPayload } =
            documentPayload;

          const retryResult = await supabase
            .from("documents")
            .upsert(legacyDocumentPayload, {
              onConflict: "slug",
            })
            .select("id")
            .single();

          upsertedDocument = retryResult.data;
          documentError = retryResult.error;
        }

        if (documentError || !upsertedDocument?.id) {
          return json(
            {
              error:
                documentError?.message ??
                "Failed to upsert document: no document id returned.",
            },
            { status: 500 }
          );
        }

        const documentId = String(upsertedDocument.id);

        const { error: deleteChunksError } = await supabase
          .from("document_chunks")
          .delete()
          .eq("document_id", documentId);

        if (deleteChunksError) {
          return json({ error: deleteChunksError.message }, { status: 500 });
        }

        if (chunks.length > 0) {
          const chunkRows = chunks.map((chunk, index) => ({
            document_id: documentId,
            chunk_index: index,
            content: chunk.content,
            content_hash: chunk.contentHash,
            keywords,
            metadata: {
              slug,
              title,
              category,
              source,
              source_url: sourceUrl,
              source_type: sourceType,
              updated_at: updatedAt,
              summary,
              import_source: "admin_api",
              char_count: chunk.content.length,
            },
          }));

          let insertedChunkCount = 0;

          for (const chunkRow of chunkRows) {
            let { error: insertChunkError } = await supabase
              .from("document_chunks")
              .insert(chunkRow);

            if (
              insertChunkError &&
              isMissingContentHashColumn(insertChunkError)
            ) {
              warnings.push(
                `Inserted chunk ${chunkRow.chunk_index} without content_hash because document_chunks.content_hash is missing. Run supabase/deduplication.sql.`
              );

              const { content_hash: _contentHash, ...legacyChunkRow } =
                chunkRow;

              const retryResult = await supabase
                .from("document_chunks")
                .insert(legacyChunkRow);

              insertChunkError = retryResult.error;
            }

            if (!insertChunkError) {
              insertedChunkCount += 1;
              continue;
            }

            if (isUniqueConflict(insertChunkError)) {
              warnings.push(
                `Skipped duplicate chunk at index ${chunkRow.chunk_index}.`
              );
              continue;
            }

            return json({ error: insertChunkError.message }, { status: 500 });
          }

          return json({
            documentId,
            slug,
            chunkCount: insertedChunkCount,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
        }

        return json({
          documentId,
          slug,
          chunkCount: 0,
          warnings: warnings.length > 0 ? warnings : undefined,
        });
      },
    },
  },
});
