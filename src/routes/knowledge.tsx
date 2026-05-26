import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { mockDocs } from "@/lib/mock-data";
import { BookOpen, Search, FileText, Upload, Database, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/knowledge")({
  component: KnowledgePage,
  head: () => ({ meta: [{ title: "Knowledge Base — UST Buddy" }] }),
});

function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(mockDocs.map((d) => d.category)))];
  const filtered = mockDocs.filter((d) => {
    const matchesQ =
      !query ||
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.titleZh.includes(query);
    const matchesC = category === "All" || d.category === category;
    return matchesQ && matchesC;
  });

  const totalChunks = mockDocs.reduce((a, d) => a + d.chunks, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs text-muted-foreground">Admin · 管理員</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Knowledge Base</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              知識庫 · Curated freshman documents indexed for UST Buddy
            </p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload document
          </Link>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <StatCard icon={FileText} label="Documents" zh="文件總數" value={mockDocs.length} />
          <StatCard icon={Layers} label="Indexed chunks" zh="索引片段" value={totalChunks} />
          <StatCard
            icon={Database}
            label="Categories"
            zh="分類"
            value={categories.length - 1}
          />
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents · 搜尋文件"
              className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md border transition-colors",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Docs grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="group rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-primary/10 text-primary">
                  {d.type}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold leading-snug">{d.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{d.titleZh}</p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{d.category}</span>
                <span>
                  {d.chunks} chunks · {d.size}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No documents match your search.
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  zh,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  zh: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {label} · <span className="text-[10px]">{zh}</span>
          </p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
