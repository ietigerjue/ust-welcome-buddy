import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { mockDocs } from "@/lib/mock-data";
import { FileText, Upload, Trash2, Eye } from "lucide-react";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
  head: () => ({ meta: [{ title: "Documents — UST Buddy" }] }),
});

function DocumentsPage() {
  const [docs, setDocs] = useState(mockDocs);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs text-muted-foreground">Admin · 管理員</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Documents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              文件列表 · All indexed sources powering UST Buddy
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

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <th className="text-left font-medium px-4 py-3">Title</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                  Category
                </th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                  Type
                </th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                  Size
                </th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                  Chunks
                </th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                  Uploaded
                </th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {d.titleZh}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] bg-secondary">
                      {d.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell uppercase text-[11px] text-muted-foreground">
                    {d.type}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {d.size}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {d.chunks}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {d.uploadedAt}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDocs((ds) => ds.filter((x) => x.id !== d.id))}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {docs.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No documents yet. <Link to="/upload" className="text-primary underline">Upload one</Link>.
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
