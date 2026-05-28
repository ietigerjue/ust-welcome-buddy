import { createFileRoute } from "@tanstack/react-router";
import matter from "gray-matter";

const ALLOWED_CATEGORIES = [
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
] as const;
const METADATA_EXTRACTION_TIMEOUT_MS = 15000;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

type ParsePayload = {
  markdown?: unknown;
  filename?: unknown;
};

type ParseResponse =
  | {
      metadata: Record<string, unknown>;
      content: string;
    }
  | {
      error: string;
    };

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type GeneratedMetadata = {
  title?: unknown;
  category?: unknown;
  keywords?: unknown;
  summary?: unknown;
};

function json(data: ParseResponse, init?: ResponseInit) {
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

function serializeMetadataValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (Array.isArray(value)) {
    return value.map(serializeMetadataValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeMetadataValue(nestedValue),
      ])
    );
  }

  return value;
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function getKeywords(value: unknown) {
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

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCategory(value: unknown): AllowedCategory | "" {
  const category = getString(value).toLowerCase();

  return ALLOWED_CATEGORIES.includes(category as AllowedCategory)
    ? (category as AllowedCategory)
    : "";
}

function fallbackTitleFromContent(content: string, filename: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  if (heading) {
    return heading;
  }

  const filenameTitle = filename
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return filenameTitle || "Uploaded Markdown";
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildExtractionPrompt(markdownContent: string) {
  return [
    "You are a metadata extraction assistant for a HKUST freshman knowledge base.",
    "",
    "Given a Markdown document, extract structured metadata for importing it into a RAG knowledge base.",
    "",
    "Return JSON only.",
    "",
    "Schema:",
    "{",
    '  "title": string,',
    '  "category": "arrival" | "housing" | "transport" | "life" | "academic" | "food" | "shopping" | "official" | "course" | "other",',
    '  "keywords": string[],',
    '  "summary": string',
    "}",
    "",
    "Rules:",
    "- The title should be concise and informative.",
    "- Choose exactly one category from the allowed list.",
    "- Keywords must include both English and Chinese terms when relevant.",
    "- Generate 8-15 keywords.",
    "- Do not invent URLs, dates, or official claims.",
    '- If uncertain, use category "other".',
    "",
    "Markdown document:",
    markdownContent.slice(0, 6000),
  ].join("\n");
}

async function generateMetadataWithMiniMax(content: string) {
  const apiKey = getEnv("MINIMAX_API_KEY");
  const baseURL = getEnv("MINIMAX_BASE_URL");
  const model = getEnv("MINIMAX_MODEL");

  if (!apiKey || !baseURL || !model) {
    throw new Error("MiniMax metadata extraction config is missing.");
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  const completion = await Promise.race([
    client.chat.completions.create(
      {
        model,
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract metadata for a HKUST freshman knowledge base. Return valid JSON only.",
          },
          {
            role: "user",
            content: buildExtractionPrompt(content),
          },
        ],
      },
      { timeout: METADATA_EXTRACTION_TIMEOUT_MS }
    ),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("MiniMax metadata extraction timed out.")),
        METADATA_EXTRACTION_TIMEOUT_MS
      );
    }),
  ]);

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(stripJsonFence(raw)) as GeneratedMetadata;

  return parsed;
}

export const Route = createFileRoute("/api/admin/parse-markdown")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as
          | ParsePayload
          | null;

        if (!body || typeof body.markdown !== "string") {
          return json(
            { error: "Missing required field: markdown." },
            { status: 400 }
          );
        }

        try {
          const filename = getString(body.filename);
          const parsed = matter(body.markdown);
          const frontmatterMetadata = Object.fromEntries(
            Object.entries(parsed.data).map(([key, value]) => [
              key,
              serializeMetadataValue(value),
            ])
          );
          const content = parsed.content.trim();
          const frontmatterKeywords = getKeywords(frontmatterMetadata.keywords);
          const frontmatterCategory = normalizeCategory(
            frontmatterMetadata.category
          );
          const needsGeneratedMetadata =
            !getString(frontmatterMetadata.title) ||
            !frontmatterCategory ||
            frontmatterKeywords.length === 0;
          let generatedMetadata: GeneratedMetadata = {};

          if (needsGeneratedMetadata) {
            try {
              generatedMetadata = await generateMetadataWithMiniMax(content);
            } catch (error) {
              console.warn(
                "[admin/parse-markdown] MiniMax metadata extraction failed:",
                error instanceof Error ? error.message : error
              );
            }
          }

          const generatedKeywords = getKeywords(generatedMetadata.keywords);
          const metadata = {
            ...frontmatterMetadata,
            title:
              getString(frontmatterMetadata.title) ||
              getString(generatedMetadata.title) ||
              fallbackTitleFromContent(content, filename),
            category:
              frontmatterCategory ||
              normalizeCategory(generatedMetadata.category) ||
              "other",
            source: getString(frontmatterMetadata.source) || "Uploaded Markdown",
            source_url:
              getString(frontmatterMetadata.source_url) ||
              getString(frontmatterMetadata.sourceUrl),
            updatedAt:
              getString(frontmatterMetadata.updatedAt) ||
              getString(frontmatterMetadata.updated_at) ||
              getTodayDate(),
            keywords:
              frontmatterKeywords.length > 0 ? frontmatterKeywords : generatedKeywords,
            summary: getString(frontmatterMetadata.summary) || getString(generatedMetadata.summary),
          };

          return json({
            metadata,
            content,
          });
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to parse Markdown.",
            },
            { status: 400 }
          );
        }
      },
    },
  },
});
