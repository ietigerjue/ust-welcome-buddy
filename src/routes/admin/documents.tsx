import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";

type LoadStatus = "idle" | "loading" | "success" | "error";

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
  chunk_count: number;
};

type DocumentsResponse = {
  documents?: AdminDocument[];
  error?: string;
};

export const Route = createFileRoute("/admin/documents")({
  component: AdminDocumentsPage,
  head: () => ({
    meta: [{ title: "Admin Documents — UST Buddy" }],
  }),
});

function AdminDocumentsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDocuments() {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/documents", {
        method: "GET",
        headers: {
          "x-admin-token": adminToken,
        },
      });
      const data = (await response.json().catch(() => ({}))) as DocumentsResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load documents.");
      }

      setDocuments(data.documents ?? []);
      setStatus("success");
    } catch (error) {
      setDocuments([]);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load documents."
      );
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDocuments();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground mb-4">
              <Database className="h-3.5 w-3.5 text-primary" />
              Admin documents · 管理员知识库列表
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              查看知识库 documents
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              查看 Supabase documents 表中的已导入资料，以及每篇文档对应的
              chunks 数量。此页面不会出现在普通用户导航中。
            </p>
          </div>

          <a
            href="/admin/import"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            去导入资料
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <section className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="grid flex-1 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Admin Token <span className="text-destructive">*</span>
              </span>
              <input
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                type="password"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="输入管理员 token"
                required
              />
            </label>

            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {status === "success" ? "Refresh" : "Load documents"}
            </button>
          </form>

          <StatusLine
            status={status}
            count={documents.length}
            errorMessage={errorMessage}
          />
        </section>

        <section className="mt-6">
          {status === "success" && documents.length === 0 ? (
            <EmptyState />
          ) : null}

          {documents.length > 0 ? (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <TableHeader>Title</TableHeader>
                      <TableHeader>Category</TableHeader>
                      <TableHeader>Source</TableHeader>
                      <TableHeader>Type</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Updated</TableHeader>
                      <TableHeader>Created</TableHeader>
                      <TableHeader className="text-right">Chunks</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((document) => (
                      <tr key={document.id} className="align-top">
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {document.title}
                          </div>
                          <div className="mt-1 max-w-[280px] truncate text-xs text-muted-foreground">
                            {document.slug}
                          </div>
                        </TableCell>
                        <TableCell>{document.category}</TableCell>
                        <TableCell>
                          <SourceValue document={document} />
                        </TableCell>
                        <TableCell>{document.source_type || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge value={document.status} />
                        </TableCell>
                        <TableCell>{formatDate(document.updated_at)}</TableCell>
                        <TableCell>{formatDateTime(document.created_at)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {document.chunk_count}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {documents.map((document) => (
                  <article
                    key={document.id}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold leading-snug">
                          {document.title}
                        </h2>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {document.slug}
                        </p>
                      </div>
                      <StatusBadge value={document.status} />
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <InfoItem label="Category" value={document.category} />
                      <InfoItem label="Chunks" value={document.chunk_count} />
                      <InfoItem
                        label="Source type"
                        value={document.source_type || "—"}
                      />
                      <InfoItem
                        label="Updated"
                        value={formatDate(document.updated_at)}
                      />
                      <InfoItem
                        label="Created"
                        value={formatDateTime(document.created_at)}
                        className="col-span-2"
                      />
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Source</dt>
                        <dd className="mt-1">
                          <SourceValue document={document} />
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function StatusLine({
  status,
  count,
  errorMessage,
}: {
  status: LoadStatus;
  count: number;
  errorMessage: string;
}) {
  if (status === "idle") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        状态：输入 Admin Token 后加载 documents
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        loading documents...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        success · loaded {count} document{count === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <p className="mt-4 inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      error: {errorMessage || "Failed to load documents."}
    </p>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-sm font-medium">暂无 documents</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        可以先去 /admin/import 手动导入一篇知识库资料。
      </p>
    </div>
  );
}

function SourceValue({ document }: { document: AdminDocument }) {
  const label = document.source || "—";

  if (!document.source_url) {
    return <span>{label}</span>;
  }

  return (
    <a
      href={document.source_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-[240px] items-center gap-1 text-primary hover:underline"
      title={document.source_url}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
      {value || "—"}
    </span>
  );
}

function TableHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

function TableCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-muted-foreground ${className}`}>{children}</td>;
}

function InfoItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return value;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
