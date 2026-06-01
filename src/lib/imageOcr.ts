import {
  assertProviderRuntimeConfigured,
  getLLMProvider,
  resolveProviderRuntime,
} from "./modelRouter";

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
const OCR_TIMEOUT_MS = 90000;
const METADATA_EXTRACTION_TIMEOUT_MS = 15000;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type GeneratedMetadata = {
  title?: unknown;
  category?: unknown;
  keywords?: unknown;
  summary?: unknown;
};

export type ParsedImageKnowledge = {
  title: string;
  category: AllowedCategory;
  keywords: string[];
  summary: string;
  content: string;
  source: "Image Upload";
  source_url: string;
  source_type: "image_upload";
  updatedAt: string;
};

function getEnv(name: string) {
  const processEnv = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];
  const importMetaEnv = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env;
  const value = processEnv ?? importMetaEnv?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ensp: " ",
    emsp: " ",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const text = String(entity).toLowerCase();

    if (text.startsWith("#x")) {
      const codePoint = Number.parseInt(text.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (text.startsWith("#")) {
      const codePoint = Number.parseInt(text.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[text] ?? match;
  });
}

export function cleanOcrText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackTitle(content: string) {
  const firstLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "";

  return (firstLine || content).slice(0, 30).trim() || "Image Upload";
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
      "[image-ocr] AI metadata JSON parse failed:",
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

function buildExtractionPrompt(content: string) {
  return [
    "You are a metadata extraction assistant for a HKUST freshman knowledge base.",
    "",
    "Given text extracted from an uploaded image or long screenshot, extract structured metadata for importing it into a RAG knowledge base.",
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
    "- Do not invent URLs, dates, fees, deadlines, or official claims.",
    '- If uncertain, use category "other".',
    "",
    "Extracted text:",
    content.slice(0, 6000),
  ].join("\n");
}

async function extractTextWithTesseract(file: File) {
  const { recognize, setLogging } = await import("tesseract.js");
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const languages = getEnv("OCR_LANGUAGES") || "eng+chi_sim";

  setLogging(false);

  const result = await Promise.race([
    recognize(imageBuffer, languages),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("OCR timed out. Please try a clearer or smaller image.")),
        OCR_TIMEOUT_MS
      );
    }),
  ]);

  return result.data.text;
}

async function generateMetadataWithMiniMax(content: string) {
  const provider = await getLLMProvider("metadata_llm");
  const runtime = resolveProviderRuntime(provider);
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

  return safeParseGeneratedMetadata(completion.choices[0]?.message?.content ?? "");
}

export async function buildParsedImageKnowledgeFromText({
  content,
  sourceUrl = "",
}: {
  content: string;
  sourceUrl?: string;
}): Promise<ParsedImageKnowledge> {
  const cleanedContent = cleanOcrText(content);

  if (cleanedContent.length < 5) {
    throw new Error(
      "Image parsing did not extract readable text. Please try a clearer image or paste the text manually."
    );
  }

  let generatedMetadata: GeneratedMetadata = {};

  try {
    generatedMetadata = await generateMetadataWithMiniMax(cleanedContent);
  } catch (error) {
    console.warn(
      "[image-ocr] MiniMax metadata extraction failed:",
      error instanceof Error ? error.message : error
    );
  }

  return {
    title: getString(generatedMetadata.title) || fallbackTitle(cleanedContent),
    category: normalizeCategory(generatedMetadata.category),
    keywords: normalizeKeywords(generatedMetadata.keywords),
    summary: getString(generatedMetadata.summary),
    content: cleanedContent,
    source: "Image Upload",
    source_url: getString(sourceUrl),
    source_type: "image_upload",
    updatedAt: getTodayDate(),
  };
}

export async function parseImageWithOcrAndTextModel({
  file,
  sourceUrl = "",
}: {
  file: File;
  sourceUrl?: string;
}): Promise<ParsedImageKnowledge> {
  let rawText = "";

  try {
    rawText = await extractTextWithTesseract(file);
  } catch (error) {
    throw new Error(
      `OCR failed: ${
        error instanceof Error ? error.message : "unknown error"
      }. Please try a clearer image or paste the text manually.`
    );
  }

  return buildParsedImageKnowledgeFromText({
    content: rawText,
    sourceUrl,
  });
}
