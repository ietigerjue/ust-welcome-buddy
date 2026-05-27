import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const KNOWLEDGE_DIR = path.join(process.cwd(), "content", "knowledge");
const MIN_CHUNK_LENGTH = 500;
const MAX_CHUNK_LENGTH = 800;

type Frontmatter = {
  id?: string;
  slug?: string;
  title?: string;
  category?: string;
  source?: string;
  source_url?: string;
  updatedAt?: string | Date;
  updated_at?: string | Date;
  keywords?: string[] | string;
};

type ParsedDocument = {
  slug: string;
  title: string;
  category: string;
  source: string;
  sourceUrl: string | null;
  updatedAt: string | null;
  keywords: string[];
  content: string;
  filePath: string;
};

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);

    try {
      const content = await fs.readFile(filePath, "utf8");

      for (const line of content.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
          continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");

        process.env[key] ??= value;
      }
    } catch (error) {
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!isMissingFile) {
        throw error;
      }
    }
  }
}

async function getMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return getMarkdownFiles(fullPath);
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        return [fullPath];
      }

      return [];
    })
  );

  return files.flat().sort();
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKeywords(value: Frontmatter["keywords"]) {
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

function normalizeDate(value: Frontmatter["updatedAt"]) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  return text || null;
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
      slice.lastIndexOf(";")
    );
    const endIndex = breakAt > MIN_CHUNK_LENGTH ? breakAt + 1 : MAX_CHUNK_LENGTH;

    parts.push(remaining.slice(0, endIndex).trim());
    remaining = remaining.slice(endIndex).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function chunkMarkdown(content: string) {
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

async function parseKnowledgeDocument(filePath: string): Promise<ParsedDocument> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Frontmatter;
  const fallbackSlug = normalizeSlug(path.basename(filePath, ".md"));
  const slug = normalizeSlug(data.slug ?? data.id ?? fallbackSlug) || fallbackSlug;
  const title = String(data.title ?? "").trim();
  const category = String(data.category ?? "").trim();
  const source = String(data.source ?? "").trim();
  const keywords = normalizeKeywords(data.keywords);

  const missingFields = [
    ["id or slug", slug],
    ["title", title],
    ["category", category],
    ["source", source],
    ["keywords", keywords.length > 0],
  ].filter(([, value]) => !value);

  if (missingFields.length > 0) {
    throw new Error(
      `${path.relative(process.cwd(), filePath)} missing frontmatter: ${missingFields
        .map(([field]) => field)
        .join(", ")}`
    );
  }

  return {
    slug,
    title,
    category,
    source,
    sourceUrl: data.source_url ? String(data.source_url).trim() : null,
    updatedAt: normalizeDate(data.updated_at ?? data.updatedAt),
    keywords,
    content: parsed.content.trim(),
    filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
  };
}

async function main() {
  await loadLocalEnv();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local or your shell environment."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const files = await getMarkdownFiles(KNOWLEDGE_DIR);
  console.log(`[sync:knowledge] Found ${files.length} Markdown files.`);

  for (const file of files) {
    const document = await parseKnowledgeDocument(file);
    const chunks = chunkMarkdown(document.content);

    console.log(
      `[sync:knowledge] Syncing ${document.slug} (${chunks.length} chunks)`
    );

    const { data: upsertedDocument, error: documentError } = await supabase
      .from("documents")
      .upsert(
        {
          slug: document.slug,
          title: document.title,
          category: document.category,
          source: document.source,
          source_url: document.sourceUrl,
          source_type: "manual",
          status: "ready",
          updated_at: document.updatedAt,
        },
        {
          onConflict: "slug",
        }
      )
      .select("id")
      .single();

    if (documentError || !upsertedDocument?.id) {
      throw new Error(
        `Failed to upsert document ${document.slug}: ${
          documentError?.message ?? "No document id returned"
        }`
      );
    }

    const documentId = String(upsertedDocument.id);

    const { error: deleteChunksError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);

    if (deleteChunksError) {
      throw new Error(
        `Failed to delete old chunks for ${document.slug}: ${deleteChunksError.message}`
      );
    }

    if (chunks.length === 0) {
      continue;
    }

    const chunkRows = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: chunk,
      keywords: document.keywords,
      metadata: {
        slug: document.slug,
        title: document.title,
        category: document.category,
        source: document.source,
        source_url: document.sourceUrl,
        updated_at: document.updatedAt,
        file_path: document.filePath,
        char_count: chunk.length,
      },
    }));

    const { error: insertChunksError } = await supabase
      .from("document_chunks")
      .insert(chunkRows);

    if (insertChunksError) {
      throw new Error(
        `Failed to insert chunks for ${document.slug}: ${insertChunksError.message}`
      );
    }
  }

  console.log("[sync:knowledge] Done.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[sync:knowledge] Failed:", message);
  process.exitCode = 1;
});
