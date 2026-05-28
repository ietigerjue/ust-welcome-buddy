import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type AdminDocument = {
  id: string;
  slug: string;
  title: string;
  category: string;
  source: string | null;
  source_url: string | null;
  source_type: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
  keywords: string[];
  chunk_count: number;
};

type DocumentsResponse =
  | {
      documents: AdminDocument[];
    }
  | {
      error: string;
    };

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function json(data: DocumentsResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

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

export const Route = createFileRoute("/api/admin/documents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const supabase = getSupabaseServerClient();

        if (!supabase) {
          return json(
            { error: "Supabase server client is not configured." },
            { status: 500 }
          );
        }

        const { data: documents, error: documentsError } = await supabase
          .from("documents")
          .select(
            "id, slug, title, category, source, source_url, source_type, status, updated_at, created_at"
          )
          .order("created_at", { ascending: false });

        if (documentsError) {
          return json({ error: documentsError.message }, { status: 500 });
        }

        const documentIds = (documents ?? [])
          .map((document) => document.id)
          .filter((id): id is string => typeof id === "string");

        const chunkCounts = new Map<string, number>();

        if (documentIds.length > 0) {
          const { data: chunks, error: chunksError } = await supabase
            .from("document_chunks")
            .select("document_id, keywords")
            .in("document_id", documentIds);

          if (chunksError) {
            return json({ error: chunksError.message }, { status: 500 });
          }

          const keywordMap = new Map<string, string[]>();

          for (const chunk of chunks ?? []) {
            const documentId =
              typeof chunk.document_id === "string" ? chunk.document_id : "";

            if (!documentId) {
              continue;
            }

            chunkCounts.set(documentId, (chunkCounts.get(documentId) ?? 0) + 1);

            if (!keywordMap.has(documentId) && Array.isArray(chunk.keywords)) {
              keywordMap.set(
                documentId,
                chunk.keywords.map(String).filter(Boolean)
              );
            }
          }

          return json({
            documents: (documents ?? []).map((document) => ({
              id: String(document.id),
              slug: String(document.slug),
              title: String(document.title),
              category: String(document.category),
              source: document.source ?? null,
              source_url: document.source_url ?? null,
              source_type: document.source_type ?? null,
              status: document.status ?? null,
              updated_at: document.updated_at ?? null,
              created_at: document.created_at ?? null,
              keywords: keywordMap.get(String(document.id)) ?? [],
              chunk_count: chunkCounts.get(String(document.id)) ?? 0,
            })),
          });
        }

        return json({
          documents: (documents ?? []).map((document) => ({
            id: String(document.id),
            slug: String(document.slug),
            title: String(document.title),
            category: String(document.category),
            source: document.source ?? null,
            source_url: document.source_url ?? null,
            source_type: document.source_type ?? null,
            status: document.status ?? null,
            updated_at: document.updated_at ?? null,
            created_at: document.created_at ?? null,
            keywords: [],
            chunk_count: chunkCounts.get(String(document.id)) ?? 0,
          })),
        });
      },
    },
  },
});
