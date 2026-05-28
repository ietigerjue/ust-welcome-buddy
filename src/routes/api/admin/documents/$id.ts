import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type UpdatePayload = {
  title?: unknown;
  category?: unknown;
  source?: unknown;
  source_url?: unknown;
  keywords?: unknown;
};

type DocumentActionResponse =
  | {
      success: true;
      id: string;
      deleted?: boolean;
      updated?: boolean;
    }
  | {
      error: string;
    };

function json(data: DocumentActionResponse, init?: ResponseInit) {
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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const text = getString(value);
  return text || null;
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

export const Route = createFileRoute("/api/admin/documents/$id")({
  server: {
    handlers: {
      DELETE: async ({ params, request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const documentId = params.id?.trim();

        if (!documentId) {
          return json({ error: "Missing document id." }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        if (!supabase) {
          return json(
            { error: "Supabase server client is not configured." },
            { status: 500 }
          );
        }

        const { error } = await supabase
          .from("documents")
          .delete()
          .eq("id", documentId);

        if (error) {
          return json({ error: error.message }, { status: 500 });
        }

        return json({ success: true, id: documentId, deleted: true });
      },

      PATCH: async ({ params, request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const documentId = params.id?.trim();

        if (!documentId) {
          return json({ error: "Missing document id." }, { status: 400 });
        }

        const body = (await request.json().catch(() => null)) as
          | UpdatePayload
          | null;

        if (!body) {
          return json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const title = getString(body.title);
        const category = getString(body.category);

        if (!title || !category) {
          return json(
            { error: "Missing required fields: title, category." },
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

        const { error: documentError } = await supabase
          .from("documents")
          .update({
            title,
            category,
            source: normalizeOptionalString(body.source),
            source_url: normalizeOptionalString(body.source_url),
          })
          .eq("id", documentId);

        if (documentError) {
          return json({ error: documentError.message }, { status: 500 });
        }

        if ("keywords" in body) {
          const keywords = normalizeKeywords(body.keywords);
          const { error: chunksError } = await supabase
            .from("document_chunks")
            .update({ keywords })
            .eq("document_id", documentId);

          if (chunksError) {
            return json({ error: chunksError.message }, { status: 500 });
          }
        }

        return json({ success: true, id: documentId, updated: true });
      },
    },
  },
});
