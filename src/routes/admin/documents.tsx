import { createFileRoute } from "@tanstack/react-router";
import { Fragment as ReactFragment, useState } from "react";
import {
  ArrowRight,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
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
  keywords: string[];
  chunk_count: number;
};

type DocumentsResponse = {
  documents?: AdminDocument[];
  error?: string;
};

type ActionResponse = {
  success?: boolean;
  error?: string;
};

type EditFormState = {
  title: string;
  category: string;
  source: string;
  source_url: string;
  keywords: string;
};

export const Route = createFileRoute("/admin/documents")({
  component: AdminDocumentsPage,
  head: () => ({
    meta: [{ title: "Admin Documents — UST Buddy" }],
  }),
});

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function AdminDocumentsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyDocumentId, setBusyDocumentId] = useState("");
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [editForm, setEditForm] = useState<EditFormState>({
    title: "",
    category: "",
    source: "",
    source_url: "",
    keywords: "",
  });

  async function loadDocuments({ clearActionMessage = true } = {}) {
    setStatus("loading");
    setErrorMessage("");
    if (clearActionMessage) {
      setActionMessage("");
    }

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

  function startEdit(document: AdminDocument) {
    setActionMessage("");
    setEditingDocumentId(document.id);
    setEditForm({
      title: document.title,
      category: document.category,
      source: document.source ?? "",
      source_url: document.source_url ?? "",
      keywords: document.keywords.join(", "),
    });
  }

  function cancelEdit() {
    setEditingDocumentId("");
    setEditForm({
      title: "",
      category: "",
      source: "",
      source_url: "",
      keywords: "",
    });
  }

  async function deleteDocument(document: AdminDocument) {
    const confirmed = window.confirm(
      `确认删除「${document.title}」吗？对应的 document_chunks 会通过 Supabase cascade 一起删除。`
    );

    if (!confirmed) {
      return;
    }

    setBusyDocumentId(document.id);
    setActionMessage("");

    try {
      const response = await fetch(
        `/api/admin/documents/${encodeURIComponent(document.id)}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-token": adminToken,
          },
        }
      );
      const data = (await response.json().catch(() => ({}))) as ActionResponse;

      if (!response.ok) {
        throw new Error(data.error || "Delete failed.");
      }

      setActionMessage(`Deleted: ${document.title}`);
      await loadDocuments({ clearActionMessage: false });
    } catch (error) {
      setActionMessage(
        `Delete error: ${
          error instanceof Error ? error.message : "Delete failed."
        }`
      );
    } finally {
      setBusyDocumentId("");
    }
  }

  async function saveDocument(document: AdminDocument) {
    setBusyDocumentId(document.id);
    setActionMessage("");

    try {
      const response = await fetch(
        `/api/admin/documents/${encodeURIComponent(document.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": adminToken,
          },
          body: JSON.stringify({
            title: editForm.title,
            category: editForm.category,
            source: editForm.source,
            source_url: editForm.source_url,
            keywords: parseKeywords(editForm.keywords),
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as ActionResponse;

      if (!response.ok) {
        throw new Error(data.error || "Update failed.");
      }

      setActionMessage(`Updated: ${editForm.title}`);
      cancelEdit();
      await loadDocuments({ clearActionMessage: false });
    } catch (error) {
      setActionMessage(
        `Update error: ${
          error instanceof Error ? error.message : "Update failed."
        }`
      );
    } finally {
      setBusyDocumentId("");
    }
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
          {actionMessage ? (
            <p
              className={`mt-2 text-xs ${
                actionMessage.includes("error")
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {actionMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-6">
          {status === "success" && documents.length === 0 ? (
            <EmptyState />
          ) : null}

          {documents.length > 0 ? (
            <>
              <div className="hidden rounded-lg border border-border bg-card shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full text-left text-sm">
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
                      <TableHeader className="text-right">Actions</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((document) => (
                      <ReactFragment key={document.id}>
                        <tr className="align-top">
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
                          <TableCell>
                            <DocumentActions
                              document={document}
                              busyDocumentId={busyDocumentId}
                              isEditing={editingDocumentId === document.id}
                              onEdit={() => startEdit(document)}
                              onDelete={() => void deleteDocument(document)}
                            />
                          </TableCell>
                        </tr>
                        {editingDocumentId === document.id ? (
                          <tr>
                            <td colSpan={9} className="bg-muted/20 px-4 py-4">
                              <EditDocumentForm
                                form={editForm}
                                setForm={setEditForm}
                                isSaving={busyDocumentId === document.id}
                                onCancel={cancelEdit}
                                onSave={() => void saveDocument(document)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </ReactFragment>
                    ))}
                  </tbody>
                  </table>
                </div>
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

                    <div className="mt-4 border-t border-border pt-4">
                      <DocumentActions
                        document={document}
                        busyDocumentId={busyDocumentId}
                        isEditing={editingDocumentId === document.id}
                        onEdit={() => startEdit(document)}
                        onDelete={() => void deleteDocument(document)}
                      />
                    </div>

                    {editingDocumentId === document.id ? (
                      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
                        <EditDocumentForm
                          form={editForm}
                          setForm={setEditForm}
                          isSaving={busyDocumentId === document.id}
                          onCancel={cancelEdit}
                          onSave={() => void saveDocument(document)}
                        />
                      </div>
                    ) : null}
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

function DocumentActions({
  document,
  busyDocumentId,
  isEditing,
  onEdit,
  onDelete,
}: {
  document: AdminDocument;
  busyDocumentId: string;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isBusy = busyDocumentId === document.id;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={isBusy || isEditing}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isBusy}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Delete
      </button>
    </div>
  );
}

function EditDocumentForm({
  form,
  setForm,
  isSaving,
  onCancel,
  onSave,
}: {
  form: EditFormState;
  setForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  function updateField(field: keyof EditFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <EditField label="Title" required>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            required
          />
        </EditField>
        <EditField label="Category" required>
          <input
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            required
          />
        </EditField>
        <EditField label="Source">
          <input
            value={form.source}
            onChange={(event) => updateField("source", event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
        </EditField>
        <EditField label="Source URL">
          <input
            value={form.source_url}
            onChange={(event) => updateField("source_url", event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            placeholder="https://..."
          />
        </EditField>
        <EditField label="Keywords" className="lg:col-span-2">
          <input
            value={form.keywords}
            onChange={(event) => updateField("keywords", event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            placeholder="逗号分隔，例如 选课, course enrollment, SIS"
          />
        </EditField>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
      </div>
    </form>
  );
}

function EditField({
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
