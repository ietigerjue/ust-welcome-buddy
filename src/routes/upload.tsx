import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { UploadCloud, FileText, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload — UST Buddy" }] }),
});

type Staged = {
  id: string;
  name: string;
  size: string;
  type: string;
  status: "queued" | "processing" | "done";
};

const ALLOWED = [".txt", ".md", ".pdf"];

function UploadPage() {
  const [files, setFiles] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState("Arrival");
  const [title, setTitle] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const next: Staged[] = [];
    for (const f of Array.from(list)) {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED.includes(ext)) continue;
      next.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: formatSize(f.size),
        type: ext.slice(1),
        status: "queued",
      });
    }
    setFiles((prev) => [...prev, ...next]);
  }

  function remove(id: string) {
    setFiles((f) => f.filter((x) => x.id !== id));
  }

  function submit() {
    if (files.length === 0) return;
    setFiles((f) => f.map((x) => ({ ...x, status: "processing" })));
    setTimeout(() => {
      setFiles((f) => f.map((x) => ({ ...x, status: "done" })));
      setSubmitted(true);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs text-muted-foreground">Admin · 管理員</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Upload document</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            上載文件 · Add new freshman resources to the knowledge base
          </p>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/40 hover:bg-secondary/30"
          )}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary mb-4">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">
            Drop files here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            拖放文件或點擊選擇 · Supports .txt, .md, .pdf
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Staged files */}
        {files.length > 0 && (
          <div className="mt-6 space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {f.type.toUpperCase()} · {f.size}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {f.status === "done" ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Indexed
                    </>
                  ) : f.status === "processing" ? (
                    "Processing…"
                  ) : (
                    "Queued"
                  )}
                </span>
                {f.status !== "processing" && (
                  <button
                    onClick={() => remove(f.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          <Field label="Display title" zh="顯示標題">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="HKUST Freshman Arrival Guide"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </Field>
          <Field label="Title (Chinese)" zh="中文標題">
            <input
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="科大新生抵港指南"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </Field>
          <Field label="Category" zh="分類">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            >
              {["Arrival", "Housing", "Transport", "Food", "Telecom", "Banking", "Registration", "Life"].map(
                (c) => (
                  <option key={c}>{c}</option>
                )
              )}
            </select>
          </Field>
          <Field label="Visibility" zh="可見性">
            <select className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10">
              <option>Public to all freshmen</option>
              <option>Internal only</option>
            </select>
          </Field>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Prototype only — files are not actually parsed or stored.
          </p>
          <div className="flex gap-2">
            <Link
              to="/documents"
              className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={submit}
              disabled={files.length === 0}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Index documents
            </button>
          </div>
        </div>

        {submitted && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Documents indexed (mock)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                In the real version, content would be chunked, embedded and added to the
                vector store. View them on the{" "}
                <Link to="/documents" className="text-primary underline">
                  documents page
                </Link>
                .
              </p>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  zh,
  children,
}: {
  label: string;
  zh: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5">
        {label} <span className="text-muted-foreground">· {zh}</span>
      </label>
      {children}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
