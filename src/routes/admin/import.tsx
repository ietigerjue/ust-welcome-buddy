import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Globe2,
  ImageIcon,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { SiteNav } from "@/components/site-nav";

type ImportStatus = "idle" | "importing" | "success" | "error";
type ParseStatus = "idle" | "parsing" | "success" | "error";
type WeChatParseStatus = "idle" | "parsing" | "success" | "error";
type ImageParseStatus = "idle" | "parsing" | "success" | "error";
type UrlParseStatus = "idle" | "loading" | "success" | "error";
type DocxParseStatus = "idle" | "parsing" | "success" | "error";
type EmbeddingStatus = "idle" | "running" | "success" | "error";

const CATEGORY_OPTIONS = [
  "arrival",
  "housing",
  "transport",
  "life",
  "academic",
  "food",
  "shopping",
  "official",
  "course",
  "other",
];

type ImportResult = {
  documentId?: string;
  slug?: string;
  chunkCount?: number;
  warnings?: string[];
  error?: string;
};

type DuplicateReviewCandidate = {
  document_id: string;
  title: string;
  category: string;
  source: string;
  source_url: string;
  source_type: string;
  updated_at: string;
  similarity: number;
  matched_chunk_id: string;
  matched_chunk_preview: string;
  reason: string;
};

type DuplicateReviewResult = {
  hasPotentialDuplicates: boolean;
  threshold: number;
  candidates: DuplicateReviewCandidate[];
};

type WithDuplicateReview = {
  duplicate_review?: DuplicateReviewResult;
};

type ParseMarkdownResult = {
  metadata?: Record<string, unknown>;
  content?: string;
  error?: string;
} & WithDuplicateReview;

type ParseWeChatResult = {
  title?: string;
  category?: string;
  source?: string;
  source_url?: string;
  source_type?: string;
  updatedAt?: string;
  keywords?: string[];
  summary?: string;
  content?: string;
  error?: string;
} & WithDuplicateReview;

type ParseImageResult = {
  title?: string;
  category?: string;
  source?: string;
  source_url?: string;
  source_type?: string;
  updatedAt?: string;
  keywords?: string[];
  summary?: string;
  content?: string;
  error?: string;
} & WithDuplicateReview;

type ParseDocxResult = {
  title?: string;
  category?: string;
  source?: string;
  source_url?: string;
  source_type?: string;
  updatedAt?: string;
  keywords?: string[];
  summary?: string;
  content?: string;
  error?: string;
} & WithDuplicateReview;

type ParseUrlResult = {
  title?: string;
  category?: string;
  source?: string;
  source_url?: string;
  source_type?: string;
  updatedAt?: string;
  keywords?: string[];
  summary?: string;
  content?: string;
  error?: string;
} & WithDuplicateReview;

type EmbedChunksResult = {
  total?: number;
  processed?: number;
  success?: number;
  failed?: number;
  skipped?: number;
  failedChunkIds?: string[];
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

function metadataString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function metadataKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((keyword) => keyword.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return parseKeywords(value);
  }

  return [];
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function AdminImportPage() {
  const [adminToken, setAdminToken] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [keywords, setKeywords] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [parseMessage, setParseMessage] = useState("");
  const [wechatSourceUrl, setWechatSourceUrl] = useState("");
  const [wechatRawContent, setWechatRawContent] = useState("");
  const [wechatParseStatus, setWechatParseStatus] =
    useState<WeChatParseStatus>("idle");
  const [wechatParseMessage, setWechatParseMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageInputResetKey, setImageInputResetKey] = useState(0);
  const [imageSourceUrl, setImageSourceUrl] = useState("");
  const [imageParseStatus, setImageParseStatus] =
    useState<ImageParseStatus>("idle");
  const [imageParseMessage, setImageParseMessage] = useState("");
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [docxInputResetKey, setDocxInputResetKey] = useState(0);
  const [docxParseStatus, setDocxParseStatus] =
    useState<DocxParseStatus>("idle");
  const [docxParseMessage, setDocxParseMessage] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [urlParseStatus, setUrlParseStatus] = useState<UrlParseStatus>("idle");
  const [urlParseMessage, setUrlParseMessage] = useState("");
  const [embeddingStatus, setEmbeddingStatus] =
    useState<EmbeddingStatus>("idle");
  const [embeddingMessage, setEmbeddingMessage] = useState("");
  const [duplicateReview, setDuplicateReview] =
    useState<DuplicateReviewResult | null>(null);

  function resetImportForm() {
    setTitle("");
    setCategory("");
    setSource("");
    setSourceUrl("");
    setSourceType("");
    setUpdatedAt("");
    setKeywords("");
    setSummary("");
    setContent("");
    setParseStatus("idle");
    setParseMessage("");
    setWechatSourceUrl("");
    setWechatRawContent("");
    setWechatParseStatus("idle");
    setWechatParseMessage("");
    setImageFile(null);
    setImageInputResetKey((currentKey) => currentKey + 1);
    setImageSourceUrl("");
    setImageParseStatus("idle");
    setImageParseMessage("");
    setDocxFile(null);
    setDocxInputResetKey((currentKey) => currentKey + 1);
    setDocxParseStatus("idle");
    setDocxParseMessage("");
    setWebUrl("");
    setUrlParseStatus("idle");
    setUrlParseMessage("");
    setDuplicateReview(null);
  }

  async function handleMarkdownFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setParseStatus("parsing");
    setParseMessage("");
    setResult(null);
    setDuplicateReview(null);

    if (!file.name.toLowerCase().endsWith(".md")) {
      setParseStatus("error");
      setParseMessage("仅支持 .md 文件。");
      event.target.value = "";
      return;
    }

    try {
      const markdown = await file.text();
      const response = await fetch("/api/admin/parse-markdown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ markdown, filename: file.name }),
      });
      const data = (await response.json().catch(() => ({}))) as ParseMarkdownResult;

      if (!response.ok) {
        throw new Error(data.error || "Markdown parse failed.");
      }

      const metadata = data.metadata ?? {};
      const parsedKeywords = metadataKeywords(metadata.keywords);

      setTitle(metadataString(metadata.title));
      setCategory(metadataString(metadata.category));
      setSource(metadataString(metadata.source));
      setSourceUrl(
        metadataString(metadata.source_url) || metadataString(metadata.sourceUrl)
      );
      setSourceType(metadataString(metadata.source_type));
      setUpdatedAt(
        metadataString(metadata.updatedAt) || metadataString(metadata.updated_at)
      );
      setKeywords(parsedKeywords.join(", "));
      setSummary(metadataString(metadata.summary));
      setContent(data.content ?? "");
      setDuplicateReview(data.duplicate_review ?? null);
      setParseStatus("success");
      setParseMessage(
        `已解析 ${file.name}，请检查表单内容后再点击 Import。`
      );
    } catch (error) {
      setParseStatus("error");
      setParseMessage(
        error instanceof Error ? error.message : "Markdown parse failed."
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleParseWeChatArticle() {
    setWechatParseStatus("parsing");
    setWechatParseMessage("");
    setResult(null);
    setDuplicateReview(null);

    try {
      const response = await fetch("/api/admin/parse-wechat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          rawContent: wechatRawContent,
          source_url: wechatSourceUrl,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ParseWeChatResult;

      if (!response.ok) {
        throw new Error(data.error || "WeChat article parse failed.");
      }

      if (!data.content?.trim()) {
        throw new Error("解析成功但正文为空，请检查粘贴内容。");
      }

      setTitle(metadataString(data.title));
      setCategory(metadataString(data.category));
      setSource(metadataString(data.source));
      setSourceUrl(metadataString(data.source_url));
      setSourceType(metadataString(data.source_type));
      setUpdatedAt(metadataString(data.updatedAt));
      setKeywords(metadataKeywords(data.keywords).join(", "));
      setSummary(metadataString(data.summary));
      setContent(data.content ?? "");
      setDuplicateReview(data.duplicate_review ?? null);
      setWechatParseStatus("success");
      setWechatParseMessage("公众号文章已解析，请检查表单内容后再点击 Import。");
    } catch (error) {
      setWechatParseStatus("error");
      setWechatParseMessage(
        error instanceof Error ? error.message : "WeChat article parse failed."
      );
    }
  }

  function handleImageFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setImageParseStatus("idle");
    setImageParseMessage("");

    if (!file) {
      setImageFile(null);
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setImageFile(null);
      setImageParseStatus("error");
      setImageParseMessage("仅支持 .png、.jpg、.jpeg、.webp 图片。");
      event.target.value = "";
      return;
    }

    setImageFile(file);
  }

  async function handleParseImage() {
    if (!imageFile) {
      setImageParseStatus("error");
      setImageParseMessage("请先选择一张图片。");
      return;
    }

    setImageParseStatus("parsing");
    setImageParseMessage("");
    setResult(null);
    setDuplicateReview(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("source_url", imageSourceUrl);

      const response = await fetch("/api/admin/parse-image", {
        method: "POST",
        headers: {
          "x-admin-token": adminToken,
        },
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as ParseImageResult;

      if (!response.ok) {
        throw new Error(data.error || "Image parse failed.");
      }

      if (!data.content?.trim()) {
        throw new Error("解析成功但正文为空，请检查图片内容。");
      }

      setTitle(metadataString(data.title));
      setCategory(metadataString(data.category));
      setSource(metadataString(data.source));
      setSourceUrl(metadataString(data.source_url));
      setSourceType(metadataString(data.source_type));
      setUpdatedAt(metadataString(data.updatedAt));
      setKeywords(metadataKeywords(data.keywords).join(", "));
      setSummary(metadataString(data.summary));
      setContent(data.content ?? "");
      setDuplicateReview(data.duplicate_review ?? null);
      setImageParseStatus("success");
      setImageParseMessage("图片已解析，请检查表单内容后再点击 Import。");
    } catch (error) {
      setImageParseStatus("error");
      setImageParseMessage(
        error instanceof Error ? error.message : "Image parse failed."
      );
    }
  }

  function handleDocxFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setDocxParseStatus("idle");
    setDocxParseMessage("");

    if (!file) {
      setDocxFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
      setDocxFile(null);
      setDocxParseStatus("error");
      setDocxParseMessage("Only .docx is supported for now.");
      event.target.value = "";
      return;
    }

    if (!lowerName.endsWith(".docx")) {
      setDocxFile(null);
      setDocxParseStatus("error");
      setDocxParseMessage("Only .docx is supported for now.");
      event.target.value = "";
      return;
    }

    setDocxFile(file);
  }

  async function handleParseDocx() {
    if (!docxFile) {
      setDocxParseStatus("error");
      setDocxParseMessage("请先选择一个 .docx 文件。");
      return;
    }

    setDocxParseStatus("parsing");
    setDocxParseMessage("");
    setResult(null);
    setDuplicateReview(null);

    try {
      const formData = new FormData();
      formData.append("file", docxFile);

      const response = await fetch("/api/admin/parse-docx", {
        method: "POST",
        headers: {
          "x-admin-token": adminToken,
        },
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as ParseDocxResult;

      if (!response.ok) {
        throw new Error(data.error || "DOCX parse failed.");
      }

      if (!data.content?.trim()) {
        throw new Error("解析成功但正文为空，请检查 Word 文档内容。");
      }

      setTitle(metadataString(data.title));
      setCategory(metadataString(data.category));
      setSource(metadataString(data.source));
      setSourceUrl(metadataString(data.source_url));
      setSourceType(metadataString(data.source_type));
      setUpdatedAt(metadataString(data.updatedAt));
      setKeywords(metadataKeywords(data.keywords).join(", "));
      setSummary(metadataString(data.summary));
      setContent(data.content ?? "");
      setDuplicateReview(data.duplicate_review ?? null);
      setDocxParseStatus("success");
      setDocxParseMessage("DOCX 已解析，请检查表单内容后再点击 Import。");
    } catch (error) {
      setDocxParseStatus("error");
      setDocxParseMessage(
        error instanceof Error ? error.message : "DOCX parse failed."
      );
    }
  }

  async function handleParseUrl() {
    setUrlParseStatus("loading");
    setUrlParseMessage("");
    setResult(null);
    setDuplicateReview(null);

    try {
      const response = await fetch("/api/admin/parse-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ url: webUrl }),
      });
      const data = (await response.json().catch(() => ({}))) as ParseUrlResult;

      if (!response.ok) {
        throw new Error(data.error || "URL parse failed.");
      }

      if (!data.content?.trim()) {
        throw new Error("解析成功但正文为空，请检查 URL 内容。");
      }

      setTitle(metadataString(data.title));
      setCategory(metadataString(data.category));
      setSource(metadataString(data.source));
      setSourceUrl(metadataString(data.source_url));
      setSourceType(metadataString(data.source_type));
      setUpdatedAt(metadataString(data.updatedAt));
      setKeywords(metadataKeywords(data.keywords).join(", "));
      setSummary(metadataString(data.summary));
      setContent(data.content ?? "");
      setDuplicateReview(data.duplicate_review ?? null);
      setUrlParseStatus("success");
      setUrlParseMessage("网页已解析，请检查表单内容后再点击 Import。");
    } catch (error) {
      setUrlParseStatus("error");
      setUrlParseMessage(
        error instanceof Error ? error.message : "URL parse failed."
      );
    }
  }

  async function triggerEmbeddingBackfill(documentId?: string, chunkCount?: number) {
    if (!documentId || !chunkCount) {
      setEmbeddingStatus("idle");
      setEmbeddingMessage("");
      return;
    }

    setEmbeddingStatus("running");
    setEmbeddingMessage(`正在为 ${chunkCount} 个 chunks 生成 embeddings...`);

    try {
      const response = await fetch("/api/admin/embed-chunks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          documentId,
          maxChunks: Math.max(chunkCount, 1),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as EmbedChunksResult;

      if (!response.ok) {
        throw new Error(data.error || "Embedding backfill failed.");
      }

      if ((data.failed ?? 0) > 0) {
        setEmbeddingStatus("error");
        setEmbeddingMessage(
          `Import 已成功，但 embeddings 只完成 ${data.success ?? 0}/${data.total ?? chunkCount}，失败 ${
            data.failed
          } 个。可稍后运行 npm run embed:chunks 重试。`
        );
        return;
      }

      setEmbeddingStatus("success");
      setEmbeddingMessage(
        `Embeddings 已生成：${data.success ?? 0}/${data.total ?? chunkCount} chunks。`
      );
    } catch (error) {
      setEmbeddingStatus("error");
      setEmbeddingMessage(
        `Import 已成功，但自动 embedding 失败：${
          error instanceof Error ? error.message : "Embedding backfill failed."
        }`
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("importing");
    setResult(null);
    setEmbeddingStatus("idle");
    setEmbeddingMessage("");

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
          source_type: sourceType,
          updated_at: updatedAt,
          keywords: parseKeywords(keywords),
          summary,
          content,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ImportResult;

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      setStatus("success");
      setResult(data);
      resetImportForm();
      void triggerEmbeddingBackfill(data.documentId, data.chunkCount);
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
      <AdminNav />
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

            <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    上传 Markdown 文件
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    选择 .md 文件后，前端只读取文本并发送到后端解析
                    frontmatter。解析完成后会自动填充表单，但不会自动导入。
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  <UploadCloud className="h-4 w-4" />
                  Choose .md
                  <input
                    type="file"
                    accept=".md,text/markdown"
                    onChange={handleMarkdownFile}
                    className="sr-only"
                  />
                </label>
              </div>
              <ParseStatusMessage status={parseStatus} message={parseMessage} />
            </div>

            <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    WeChat Article Paste
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    粘贴公众号正文、纯文本或 HTML，系统会清洗正文并生成 metadata。
                    解析完成后只填充下方表单，不会自动导入数据库。
                  </p>
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Source URL
                    </span>
                    <input
                      value={wechatSourceUrl}
                      onChange={(event) => setWechatSourceUrl(event.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      placeholder="https://mp.weixin.qq.com/s/..."
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Raw Content
                    </span>
                    <textarea
                      value={wechatRawContent}
                      onChange={(event) => setWechatRawContent(event.target.value)}
                      className="min-h-[160px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      placeholder="粘贴公众号文章正文、富文本 HTML 或纯文本..."
                    />
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <WeChatParseStatusMessage
                      status={wechatParseStatus}
                      message={wechatParseMessage}
                    />
                    <button
                      type="button"
                      onClick={handleParseWeChatArticle}
                      disabled={
                        wechatParseStatus === "parsing" ||
                        !wechatRawContent.trim()
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {wechatParseStatus === "parsing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      Parse WeChat Article
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Image / Long Screenshot Import
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    上传图片或长截图后，后端会优先使用 MiniMax VLM 提取正文，失败后再尝试 OCR fallback。
                    解析完成后只填充下方表单，不会自动导入数据库。
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="grid min-w-0 flex-1 gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Source URL
                    </span>
                    <input
                      value={imageSourceUrl}
                      onChange={(event) => setImageSourceUrl(event.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      placeholder="可选，例如原图或文章链接"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {imageFile ? (
                      <p className="truncate">
                        Selected:{" "}
                        <span className="font-medium text-foreground">
                          {imageFile.name}
                        </span>{" "}
                        · {formatFileSize(imageFile.size)}
                      </p>
                    ) : (
                      <p>状态：等待选择图片文件</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      <UploadCloud className="h-4 w-4" />
                      Choose image
                      <input
                        key={imageInputResetKey}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        onChange={handleImageFile}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleParseImage}
                      disabled={imageParseStatus === "parsing" || !imageFile}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {imageParseStatus === "parsing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      Parse Image
                    </button>
                  </div>
                </div>

                <ImageParseStatusMessage
                  status={imageParseStatus}
                  message={imageParseMessage}
                />
              </div>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Word / DOCX Import
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    上传 .docx 文件后，后端会提取正文并生成 metadata。解析完成后只填充下方表单，不会自动导入数据库。
                    暂不支持 .doc 老格式。
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {docxFile ? (
                      <p className="truncate">
                        Selected:{" "}
                        <span className="font-medium text-foreground">
                          {docxFile.name}
                        </span>{" "}
                        · {formatFileSize(docxFile.size)}
                      </p>
                    ) : (
                      <p>状态：等待选择 .docx 文件</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      <UploadCloud className="h-4 w-4" />
                      Choose .docx
                      <input
                        key={docxInputResetKey}
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleDocxFile}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleParseDocx}
                      disabled={docxParseStatus === "parsing" || !docxFile}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {docxParseStatus === "parsing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Parse DOCX
                    </button>
                  </div>
                </div>

                <DocxParseStatusMessage
                  status={docxParseStatus}
                  message={docxParseMessage}
                />
              </div>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <Globe2 className="h-4 w-4 text-primary" />
                    Web URL Import
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    输入公开网页 URL，后端会抓取单个页面并清洗正文；支持单篇 mp.weixin.qq.com
                    公众号文章，并会尝试解析正文图片。不会递归抓取链接，不会自动导入数据库。
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="grid min-w-0 flex-1 gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      URL
                    </span>
                    <input
                      value={webUrl}
                      onChange={(event) => setWebUrl(event.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      placeholder="https://example.com/page"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleParseUrl}
                    disabled={urlParseStatus === "loading" || !webUrl.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {urlParseStatus === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe2 className="h-4 w-4" />
                    )}
                    Parse URL
                  </button>
                </div>

                <UrlParseStatusMessage
                  status={urlParseStatus}
                  message={urlParseMessage}
                />
              </div>
            </div>

            <DuplicateReviewPanel duplicateReview={duplicateReview} />

            <Field label="Category" required>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                required
              >
                <option value="" disabled>
                  选择 category
                </option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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

            <Field label="Updated At">
              <input
                value={updatedAt}
                onChange={(event) => setUpdatedAt(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="YYYY-MM-DD"
              />
            </Field>

            <Field label="Source Type">
              <input
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="例如 image_upload / wechat_paste / admin_import"
              />
            </Field>

            <Field label="Keywords">
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="逗号分隔，例如 选课, course enrollment, SIS, Student Center"
              />
            </Field>

            <Field label="Summary" className="sm:col-span-2">
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="min-h-[88px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="解析后自动生成，可手动调整。"
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
            <div className="grid gap-2">
              <StatusMessage status={status} result={result} />
              <EmbeddingStatusMessage
                status={embeddingStatus}
                message={embeddingMessage}
              />
            </div>
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

function DuplicateReviewPanel({
  duplicateReview,
}: {
  duplicateReview: DuplicateReviewResult | null;
}) {
  const candidates = duplicateReview?.candidates ?? [];

  if (!duplicateReview?.hasPotentialDuplicates || candidates.length === 0) {
    return null;
  }

  return (
    <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
      <div className="font-medium">Potential duplicate documents</div>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
        This content may overlap with existing knowledge base documents. Please
        review before importing. You can still continue Import.
      </p>
      <div className="mt-3 grid gap-3">
        {candidates.map((candidate) => (
          <div
            key={`${candidate.document_id}-${candidate.matched_chunk_id}`}
            className="rounded-md border border-amber-200 bg-background/80 p-3"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-medium text-foreground">
                  {candidate.title}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{candidate.category || "uncategorized"}</span>
                  <span>{candidate.source_type || "unknown source type"}</span>
                  {candidate.source ? <span>{candidate.source}</span> : null}
                </div>
              </div>
              <div className="shrink-0 text-xs font-medium text-amber-700">
                {Math.round(candidate.similarity * 100)}%
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {candidate.matched_chunk_preview}
            </p>
            {candidate.source_url ? (
              <a
                href={candidate.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Open source
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ParseStatusMessage({
  status,
  message,
}: {
  status: ParseStatus;
  message: string;
}) {
  if (status === "idle") {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        状态：等待选择 Markdown 文件
      </p>
    );
  }

  if (status === "parsing") {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        parsing markdown...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </p>
    );
  }

  return (
    <p className="mt-3 inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || "Markdown parse failed."}
    </p>
  );
}

function WeChatParseStatusMessage({
  status,
  message,
}: {
  status: WeChatParseStatus;
  message: string;
}) {
  if (status === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        状态：等待粘贴公众号正文
      </p>
    );
  }

  if (status === "parsing") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        parsing wechat article...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || "WeChat article parse failed."}
    </p>
  );
}

function ImageParseStatusMessage({
  status,
  message,
}: {
  status: ImageParseStatus;
  message: string;
}) {
  if (status === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        状态：选择图片后点击 Parse Image
      </p>
    );
  }

  if (status === "parsing") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        parsing image...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || "Image parse failed."}
    </p>
  );
}

function DocxParseStatusMessage({
  status,
  message,
}: {
  status: DocxParseStatus;
  message: string;
}) {
  if (status === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        状态：选择 .docx 后点击 Parse DOCX
      </p>
    );
  }

  if (status === "parsing") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        parsing docx...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || "DOCX parse failed."}
    </p>
  );
}

function UrlParseStatusMessage({
  status,
  message,
}: {
  status: UrlParseStatus;
  message: string;
}) {
  if (status === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        状态：输入公开网页 URL 后点击 Parse URL
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        parsing url...
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || "URL parse failed."}
    </p>
  );
}

function EmbeddingStatusMessage({
  status,
  message,
}: {
  status: EmbeddingStatus;
  message: string;
}) {
  if (status === "idle") {
    return null;
  }

  if (status === "running") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {message || "generating embeddings..."}
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || "Embedding backfill failed."}
    </p>
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
      <div className="grid gap-1 text-xs text-foreground">
        <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            success
          </span>
          <span>slug: {result?.slug}</span>
          <span>chunk count: {result?.chunkCount}</span>
        </div>
        {result?.warnings?.length ? (
          <div className="text-muted-foreground">
            warnings: {result.warnings.join(" ")}
          </div>
        ) : null}
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
