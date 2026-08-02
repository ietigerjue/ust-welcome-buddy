import { createFileRoute } from "@tanstack/react-router";
import mammoth from "mammoth";
import {
  assertProviderRuntimeConfigured,
  getLLMProvider,
  resolveProviderRuntimeWithStoredSecrets,
} from "@/lib/modelRouter";
import {
  reviewSemanticDuplicates,
  type SemanticDuplicateReviewResult,
} from "@/lib/semanticDuplicateReview";

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
const MAX_DOCX_SIZE_BYTES = 10 * 1024 * 1024;
const METADATA_EXTRACTION_TIMEOUT_MS = 15000;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

type ParseDocxResponse =
  | {
      title: string;
      category: string;
      source: string;
      source_url: "";
      source_type: "docx_upload";
      updatedAt: string;
      keywords: string[];
      summary: string;
      content: string;
      duplicate_review: SemanticDuplicateReviewResult;
    }
  | {
      error: string;
    };

type GeneratedMetadata = {
  title?: unknown;
  category?: unknown;
  keywords?: unknown;
  summary?: unknown;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function json(data: ParseDocxResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAuthorized(request: Request) {
  const expectedToken = getEnv("ADMIN_IMPORT_TOKEN");
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

function getString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCategory(value: unknown): AllowedCategory {
  const category = getString(value).toLowerCase();

  return ALLOWED_CATEGORIES.includes(category as AllowedCategory)
    ? (category as AllowedCategory)
    : "other";
}

function normalizeKeywords(value: unknown) {
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

function cleanDocxText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(value: string) {
  const withoutFence = stripJsonFence(value);
  const startIndex = withoutFence.indexOf("{");
  const endIndex = withoutFence.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return withoutFence;
  }

  return withoutFence.slice(startIndex, endIndex + 1);
}

function safeParseGeneratedMetadata(value: string) {
  try {
    return JSON.parse(extractJsonObject(value)) as GeneratedMetadata;
  } catch (error) {
    console.warn(
      "[admin/parse-docx] AI metadata JSON parse failed:",
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

function titleFromFilename(fileName: string) {
  return fileName
    .replace(/\.docx$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function fallbackTitle(fileName: string, content: string) {
  return (
    titleFromFilename(fileName) ||
    content
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean)
      ?.slice(0, 40) ||
    "Uploaded Word Document"
  );
}

function buildExtractionPrompt(content: string, fileName: string) {
  return [
    "You are a metadata extraction assistant for a HKUST freshman knowledge base.",
    "",
    "Given extracted Word document text, extract structured metadata for importing it into a RAG knowledge base.",
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
    `File name: ${fileName}`,
    "",
    "Extracted Word text:",
    content.slice(0, 6000),
  ].join("\n");
}

async function generateMetadata(content: string, fileName: string) {
  const provider = await getLLMProvider("metadata_llm");
  const runtime = await resolveProviderRuntimeWithStoredSecrets(provider);
  assertProviderRuntimeConfigured(provider, runtime);

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: runtime.apiKey ?? "",
    baseURL: runtime.baseUrl ?? "",
  });

  const completion = await Promise.race([
    client.chat.completions.create(
      {
        model: runtime.model ?? "",
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
            content: buildExtractionPrompt(content, fileName),
          },
        ],
      },
      { timeout: METADATA_EXTRACTION_TIMEOUT_MS }
    ),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("DOCX metadata extraction timed out.")),
        METADATA_EXTRACTION_TIMEOUT_MS
      );
    }),
  ]);

  return safeParseGeneratedMetadata(completion.choices[0]?.message?.content ?? "");
}

function validateDocxFile(file: File) {
  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    throw new Error("Only .docx is supported for now.");
  }

  if (!lowerName.endsWith(".docx")) {
    throw new Error("Only .docx is supported for now.");
  }

  if (file.size > MAX_DOCX_SIZE_BYTES) {
    throw new Error("DOCX file is too large. Please upload a file under 10MB.");
  }

  return fileName;
}

async function extractDocxText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    console.warn("[admin/parse-docx] mammoth messages:", result.messages);
  }

  return cleanDocxText(result.value);
}

export const Route = createFileRoute("/api/admin/parse-docx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const formData = await request.formData().catch(() => null);
        const file = formData?.get("file");

        if (!(file instanceof File)) {
          return json(
            { error: "Missing required multipart file field: file." },
            { status: 400 }
          );
        }

        let fileName: string;

        try {
          fileName = validateDocxFile(file);
        } catch (error) {
          return json(
            { error: error instanceof Error ? error.message : "Invalid file." },
            { status: 400 }
          );
        }

        try {
          const content = await extractDocxText(file);

          if (content.length < 50) {
            return json(
              {
                error:
                  "Extracted DOCX content is too short. Please check the document text.",
              },
              { status: 400 }
            );
          }

          let metadata: GeneratedMetadata = {};

          try {
            metadata = await generateMetadata(content, fileName);
          } catch (error) {
            console.warn(
              "[admin/parse-docx] Metadata generation failed:",
              error instanceof Error ? error.message : error
            );
          }

          const duplicateReview = await reviewSemanticDuplicates({ content });

          return json({
            title: getString(metadata.title) || fallbackTitle(fileName, content),
            category: normalizeCategory(metadata.category),
            source: titleFromFilename(fileName) || "Uploaded Word Document",
            source_url: "",
            source_type: "docx_upload",
            updatedAt: getTodayDate(),
            keywords: normalizeKeywords(metadata.keywords),
            summary: getString(metadata.summary),
            content,
            duplicate_review: duplicateReview,
          });
        } catch (error) {
          console.error(
            "[admin/parse-docx] DOCX parsing failed:",
            error instanceof Error ? error.message : error
          );

          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to parse DOCX.",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
