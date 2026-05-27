import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

type ImportStatus = "idle" | "importing" | "success" | "error";

type ImportResult = {
  documentId?: string;
  slug?: string;
  chunkCount?: number;
  error?: string;
};

export const Route = createFileRoute("/admin/import")({
  component: AdminImportPage,
  head: () => ({
    meta: [{ title: "Admin Import — UST Buddy" }],
  }),
});

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function AdminImportPage() {
  const [adminToken, setAdminToken] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("importing");
    setResult(null);

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          title,
          category,
          source,
          source_url: sourceUrl,
          keywords: parseKeywords(keywords),
          content,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ImportResult;

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      setStatus("success");
      setResult(data);
    } catch (error) {
      setStatus("error");
      setResult({
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground mb-4">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Admin import · 管理员知识库导入
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            导入知识库资料
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            手动导入一篇知识库文档到 Supabase。系统会自动生成 slug，并把正文切分为
            chunks 写入 document_chunks。此页面不会出现在主导航中。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Admin Token" required>
              <input
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                type="password"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="输入管理员 token"
                required
              />
            </Field>

            <Field label="Category" required>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="例如 Academic Systems"
                required
              />
            </Field>

            <Field label="Title" required className="sm:col-span-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="例如 HKUST Course Enrollment Guide"
                required
              />
            </Field>

            <Field label="Source">
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="例如 Admin import / HKUST official page"
              />
            </Field>

            <Field label="Source URL">
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="https://..."
              />
            </Field>

            <Field label="Keywords" className="sm:col-span-2">
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="逗号分隔，例如 选课, course enrollment, SIS, Student Center"
              />
            </Field>

            <Field label="Content" required className="sm:col-span-2">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-[260px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="粘贴要导入的知识库正文..."
                required
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusMessage status={status} result={result} />
            <button
              type="submit"
              disabled={status === "importing"}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "importing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Import
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function StatusMessage({
  status,
  result,
}: {
  status: ImportStatus;
  result: ImportResult | null;
}) {
  if (status === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        状态：等待导入
      </p>
    );
  }

  if (status === "importing") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        importing...
      </p>
    );
  }

  if (status === "success") {
    return (
      <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          success
        </span>
        <span>slug: {result?.slug}</span>
        <span>chunk count: {result?.chunkCount}</span>
      </div>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      error: {result?.error || "Import failed."}
    </p>
  );
}
