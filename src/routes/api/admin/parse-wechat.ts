import { createFileRoute } from "@tanstack/react-router";
import * as cheerio from "cheerio";
import {
  assertProviderRuntimeConfigured,
  getLLMProvider,
  resolveProviderRuntime,
} from "@/lib/modelRouter";

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

type ParseWechatPayload = {
  rawContent?: unknown;
  source_url?: unknown;
};

type ParseWechatResponse =
  | {
      title: string;
      category: string;
      source: string;
      source_url: string;
      source_type: "wechat_paste";
      updatedAt: string;
      keywords: string[];
      summary: string;
      content: string;
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

function json(data: ParseWechatResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getAdminImportToken() {
  return getEnv("ADMIN_IMPORT_TOKEN");
}

function isAuthorized(request: Request) {
  const expectedToken = getAdminImportToken();
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

function preview(value: string) {
  return value.slice(0, 200);
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

function extractHtmlHeading(rawContent: string) {
  if (!/<[a-z][\s\S]*>/i.test(rawContent)) {
    return "";
  }

  try {
    const $ = cheerio.load(rawContent);
    $("script, style, noscript, svg, canvas, iframe").remove();
    const heading = $("h1, h2")
      .toArray()
      .map((element) => normalizeWhitespace($(element).text()))
      .find(Boolean);

    return heading ?? "";
  } catch (error) {
    console.warn(
      "[admin/parse-wechat] HTML heading extraction failed:",
      error instanceof Error ? error.message : error
    );
    return "";
  }
}

function cleanWechatContent(rawContent: string) {
  const normalizedContent = rawContent.replace(/\r\n/g, "\n");

  if (!/<[a-z][\s\S]*>/i.test(normalizedContent)) {
    return normalizeWhitespace(normalizedContent);
  }

  const htmlWithLineBreaks = normalizedContent
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<(p|div|section|article|h[1-6]|li|ul|ol|blockquote|table|tr)\b[^>]*>/gi,
      "\n$&"
    )
    .replace(
      /<\/(p|div|section|article|h[1-6]|li|ul|ol|blockquote|table|tr)>/gi,
      "$&\n"
    );

  const $ = cheerio.load(htmlWithLineBreaks);

  $("script, style, noscript, svg, canvas, iframe").remove();

  return normalizeWhitespace($.root().text());
}

function normalizeWhitespace(value: string) {
  return decodeHtmlEntities(value)
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
      "[admin/parse-wechat] AI metadata JSON parse failed:",
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

function fallbackTitle(content: string, htmlHeading: string) {
  if (htmlHeading) {
    return htmlHeading;
  }

  const firstMeaningfulLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "";

  return (firstMeaningfulLine || content).slice(0, 30).trim() || "WeChat Article";
}

function buildExtractionPrompt(content: string) {
  return [
    "You are a metadata extraction assistant for a HKUST freshman knowledge base.",
    "",
    "Given pasted WeChat article content, extract structured metadata for importing it into a RAG knowledge base.",
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
    "Cleaned article content:",
    content.slice(0, 6000),
  ].join("\n");
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

  const raw = completion.choices[0]?.message?.content ?? "";
  const metadata = safeParseGeneratedMetadata(raw);

  if (Object.keys(metadata).length > 0) {
    console.log("[admin/parse-wechat] AI metadata parse success");
  } else {
    console.log("[admin/parse-wechat] AI metadata parse fail");
  }

  return metadata;
}

export const Route = createFileRoute("/api/admin/parse-wechat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as
          | ParseWechatPayload
          | null;

        if (!body || typeof body.rawContent !== "string") {
          return json(
            { error: "Missing required field: rawContent." },
            { status: 400 }
          );
        }

        console.log("[admin/parse-wechat] rawContent length:", body.rawContent.length);
        console.log(
          "[admin/parse-wechat] rawContent preview:",
          preview(body.rawContent)
        );

        const htmlHeading = extractHtmlHeading(body.rawContent);
        const content = cleanWechatContent(body.rawContent);

        console.log("[admin/parse-wechat] cleanedContent length:", content.length);
        console.log(
          "[admin/parse-wechat] cleanedContent preview:",
          preview(content)
        );

        if (content.length < 20) {
          return json(
            { error: "内容太短，无法解析。请粘贴更完整的公众号正文。" },
            { status: 400 }
          );
        }

        let generatedMetadata: GeneratedMetadata = {};

        try {
          generatedMetadata = await generateMetadataWithMiniMax(content);
        } catch (error) {
          console.warn(
            "[admin/parse-wechat] MiniMax metadata extraction failed:",
            error instanceof Error ? error.message : error
          );
          console.log("[admin/parse-wechat] AI metadata parse fail");
        }

        const keywords = normalizeKeywords(generatedMetadata.keywords);
        const finalResponse = {
          title:
            getString(generatedMetadata.title) ||
            fallbackTitle(content, htmlHeading) ||
            "Untitled WeChat Article",
          category: normalizeCategory(generatedMetadata.category),
          source: "WeChat Article Paste",
          source_url: getString(body.source_url),
          source_type: "wechat_paste" as const,
          updatedAt: getTodayDate(),
          keywords,
          summary: getString(generatedMetadata.summary),
          content,
        };

        console.log("[admin/parse-wechat] final response fields:", {
          title: finalResponse.title,
          category: finalResponse.category,
          source: finalResponse.source,
          source_url: finalResponse.source_url,
          source_type: finalResponse.source_type,
          updatedAt: finalResponse.updatedAt,
          keywordsCount: finalResponse.keywords.length,
          summaryLength: finalResponse.summary.length,
          contentLength: finalResponse.content.length,
        });
        console.log("[admin/parse-wechat] finalResponse:", finalResponse);

        return json(finalResponse);
      },
    },
  },
});
