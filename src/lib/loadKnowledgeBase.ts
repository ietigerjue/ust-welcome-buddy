import matter from "gray-matter";
import type { KnowledgeDocument } from "@/data/knowledgeBase";

type MarkdownModule = string;

type KnowledgeFrontmatter = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  source?: unknown;
  updatedAt?: unknown;
  keywords?: unknown;
};

const markdownFiles = import.meta.glob<MarkdownModule>(
  "../../content/knowledge/**/*.md",
  {
    eager: true,
    import: "default",
    query: "?raw",
  }
);

function requireString(
  data: KnowledgeFrontmatter,
  key: keyof KnowledgeFrontmatter,
  filePath: string
) {
  const value = data[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid knowledge document frontmatter: ${filePath} missing ${key}`);
  }

  return value.trim();
}

function parseUpdatedAt(value: unknown, filePath: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  throw new Error(
    `Invalid knowledge document frontmatter: ${filePath} missing updatedAt`
  );
}

function parseKeywords(value: unknown, filePath: string) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  throw new Error(`Invalid knowledge document frontmatter: ${filePath} missing keywords`);
}

function parseKnowledgeDocument(
  filePath: string,
  rawMarkdown: string
): KnowledgeDocument {
  const parsed = matter(rawMarkdown);
  const data = parsed.data as KnowledgeFrontmatter;
  const content = parsed.content.trim();

  if (!content) {
    throw new Error(`Invalid knowledge document: ${filePath} has empty content`);
  }

  return {
    id: requireString(data, "id", filePath),
    title: requireString(data, "title", filePath),
    category: requireString(data, "category", filePath),
    content,
    source: requireString(data, "source", filePath),
    updatedAt: parseUpdatedAt(data.updatedAt, filePath),
    keywords: parseKeywords(data.keywords, filePath),
  };
}

export function loadKnowledgeBase(): KnowledgeDocument[] {
  return Object.entries(markdownFiles)
    .map(([filePath, rawMarkdown]) => parseKnowledgeDocument(filePath, rawMarkdown))
    .sort((a, b) => a.id.localeCompare(b.id));
}
