import { lookup } from "node:dns/promises";
import net from "node:net";
import { createFileRoute } from "@tanstack/react-router";
import * as cheerio from "cheerio";
import { understandImageWithMiniMaxVlm } from "@/lib/imageUnderstanding";
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
const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_WECHAT_IMAGES = 6;
const METADATA_EXTRACTION_TIMEOUT_MS = 15000;
const ALLOWED_REMOTE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const WECHAT_IMAGE_UNDERSTANDING_PROMPT = [
  "你是微信公众号文章图片理解助手。请读取图片中所有可见文字，并提取对 HKUST 新生知识库有用的关键信息。",
  "",
  "要求：",
  "1. 尽量完整提取图片中的文字。",
  "2. 保留标题、段落、列表结构。",
  "3. 如果图片是长图、海报、流程图或清单，请整理成清晰 Markdown。",
  "4. 不要编造图片中没有的信息。",
  "5. 如果某些文字无法识别，请标注为“无法识别”。",
  "6. 输出正文即可，不要输出 JSON。",
].join("\n");

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

type ParseUrlPayload = {
  url?: unknown;
};

type ParseUrlResponse =
  | {
      title: string;
      category: string;
      source: string;
      source_url: string;
      source_type: "web_url" | "wechat_url";
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

type WeChatImageParseResult = {
  url: string;
  content?: string;
  error?: string;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function json(data: ParseUrlResponse, init?: ResponseInit) {
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

function parseHttpUrl(rawUrl: unknown) {
  const urlText = getString(rawUrl);

  if (!urlText) {
    throw new Error("Missing required field: url.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlText);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http and https URLs are allowed.");
  }

  parsedUrl.hash = "";

  return parsedUrl;
}

function isPrivateIp(address: string) {
  const ipType = net.isIP(address);

  if (ipType === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  if (ipType === 6) {
    const normalized = address.toLowerCase();

    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  return false;
}

async function assertUrlIsPublic(url: URL) {
  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0"
  ) {
    throw new Error("Localhost URLs are not allowed.");
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Private or local IP URLs are not allowed.");
  }

  const addresses = await lookup(hostname, { all: true }).catch((error) => {
    throw new Error(
      `Could not resolve URL hostname: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  });

  if (addresses.length === 0) {
    throw new Error("Could not resolve URL hostname.");
  }

  if (addresses.some((address) => isPrivateIp(address.address))) {
    throw new Error("URL resolves to a private or local network address.");
  }
}

async function readLimitedBytes(
  response: Response,
  maxBytes: number,
  limitMessage: string
) {
  const reader = response.body?.getReader();

  if (!reader) {
    return Buffer.alloc(0);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(limitMessage);
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function readLimitedText(response: Response) {
  const buffer = await readLimitedBytes(
    response,
    MAX_BYTES,
    "Fetched content is too large. Limit is 2MB."
  );

  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

async function fetchPublicUrl(
  url: URL,
  redirectCount = 0,
  accept = "text/html,text/plain,application/xhtml+xml"
): Promise<Response> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error("Too many redirects.");
  }

  await assertUrlIsPublic(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "UST Buddy Admin URL Import/1.0 (+https://ust-buddy.local)",
        Accept: accept,
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("Redirect response missing Location header.");
      }

      const nextUrl = new URL(location, url);
      return fetchPublicUrl(nextUrl, redirectCount + 1, accept);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractPageContent(rawText: string, contentType: string) {
  if (!contentType.includes("html") && !/<[a-z][\s\S]*>/i.test(rawText)) {
    const content = normalizeWhitespace(rawText);

    return {
      title: content.split("\n").find(Boolean)?.slice(0, 80) ?? "Web Page",
      content,
    };
  }

  const htmlWithLineBreaks = rawText
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<(p|div|section|article|main|h[1-6]|li|ul|ol|blockquote|table|tr)\b[^>]*>/gi,
      "\n$&"
    )
    .replace(
      /<\/(p|div|section|article|main|h[1-6]|li|ul|ol|blockquote|table|tr)>/gi,
      "$&\n"
    );
  const $ = cheerio.load(htmlWithLineBreaks);

  $("script, style, noscript, svg, canvas, iframe, form, button").remove();
  $("nav, footer, aside, [aria-hidden='true']").remove();

  const title =
    normalizeWhitespace($("meta[property='og:title']").attr("content") ?? "") ||
    normalizeWhitespace($("title").first().text()) ||
    normalizeWhitespace($("h1").first().text()) ||
    "Web Page";
  const mainText =
    normalizeWhitespace($("article").first().text()) ||
    normalizeWhitespace($("main").first().text()) ||
    normalizeWhitespace($("body").text()) ||
    normalizeWhitespace($.root().text());

  return {
    title,
    content: mainText,
  };
}

function isWeChatArticleUrl(url: URL) {
  return url.protocol === "https:" && url.hostname.toLowerCase() === "mp.weixin.qq.com";
}

function extractFirstNonEmptyLine(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
}

function normalizePossibleImageUrl(rawUrl: string, pageUrl: URL) {
  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl || trimmedUrl.startsWith("data:")) {
    return "";
  }

  try {
    const imageUrl = new URL(trimmedUrl, pageUrl);

    if (!["http:", "https:"].includes(imageUrl.protocol)) {
      return "";
    }

    imageUrl.hash = "";

    return imageUrl.toString();
  } catch {
    return "";
  }
}

function extractWeChatArticle(rawText: string, pageUrl: URL) {
  const $ = cheerio.load(rawText);

  $("script, style, noscript, svg, canvas, iframe, form, button").remove();

  const title =
    normalizeWhitespace($("#activity-name").first().text()) ||
    normalizeWhitespace($("meta[property='og:title']").attr("content") ?? "") ||
    normalizeWhitespace($("meta[name='twitter:title']").attr("content") ?? "") ||
    normalizeWhitespace($("h1").first().text()) ||
    normalizeWhitespace($("title").first().text());
  const accountName =
    normalizeWhitespace($("#js_name").first().text()) ||
    normalizeWhitespace($("meta[property='og:article:author']").attr("content") ?? "") ||
    normalizeWhitespace($("meta[name='author']").attr("content") ?? "") ||
    normalizeWhitespace($(".rich_media_meta_nickname").first().text()) ||
    normalizeWhitespace($("#profileBt").first().text());
  const contentRoot = $("#js_content").first();
  const bodyRoot = contentRoot.length ? contentRoot : $("article").first().length ? $("article").first() : $("body");

  bodyRoot.find("br").replaceWith("\n");
  bodyRoot
    .find("p, div, section, article, h1, h2, h3, h4, h5, h6, li, blockquote, table, tr")
    .each((_, element) => {
      const node = $(element);
      node.prepend("\n");
      node.append("\n");
    });

  const imageUrls = new Map<string, string>();

  bodyRoot.find("img").each((_, element) => {
    const node = $(element);

    for (const attrName of ["data-src", "data-original", "data-backsrc", "src"]) {
      const imageUrl = normalizePossibleImageUrl(node.attr(attrName) ?? "", pageUrl);

      if (imageUrl) {
        imageUrls.set(imageUrl, imageUrl);
        break;
      }
    }
  });

  return {
    title,
    accountName,
    content: normalizeWhitespace(bodyRoot.text()),
    imageUrls: Array.from(imageUrls.values()),
  };
}

function getWeChatAbnormalMessage(rawText: string, title: string, content: string) {
  const normalizedText = normalizeWhitespace(rawText);
  const abnormalPatterns = [
    "该内容已被发布者删除",
    "此内容因违规无法查看",
    "链接已过期",
    "页面不存在",
    "当前环境异常",
    "访问过于频繁",
    "请在微信客户端打开",
    "请输入验证码",
    "系统错误",
    "操作频繁",
    "无法打开页面",
  ];
  const matchedPattern = abnormalPatterns.find((pattern) =>
    normalizedText.includes(pattern)
  );

  if (matchedPattern) {
    return `WeChat returned an abnormal page: ${matchedPattern}`;
  }

  if (!title && content.length < 40) {
    return "WeChat article title and body could not be extracted. The article may be unavailable or access-restricted.";
  }

  if (content.length < 40) {
    return "WeChat article body is too short to import. The article may be unavailable or access-restricted.";
  }

  return "";
}

async function fetchRemoteImage(imageUrlText: string) {
  const imageUrl = parseHttpUrl(imageUrlText);
  const response = await fetchPublicUrl(
    imageUrl,
    0,
    "image/png,image/jpeg,image/webp,*/*"
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_REMOTE_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Unsupported image content type: ${contentType || "unknown"}`);
  }

  const buffer = await readLimitedBytes(
    response,
    MAX_IMAGE_BYTES,
    "Fetched image is too large. Limit is 8MB."
  );

  return { buffer, contentType };
}

async function parseWeChatImages(imageUrls: string[]) {
  const selectedImageUrls = imageUrls.slice(0, MAX_WECHAT_IMAGES);
  const results: WeChatImageParseResult[] = [];

  for (const imageUrl of selectedImageUrls) {
    try {
      const { buffer, contentType } = await fetchRemoteImage(imageUrl);
      const content = normalizeWhitespace(
        await understandImageWithMiniMaxVlm(
          buffer,
          contentType,
          WECHAT_IMAGE_UNDERSTANDING_PROMPT
        )
      );

      results.push({ url: imageUrl, content });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.warn("[admin/parse-url] WeChat image parsing failed:", {
        imageUrl,
        message,
      });

      results.push({ url: imageUrl, error: message });
    }
  }

  return results;
}

function buildWeChatContent(
  bodyContent: string,
  imageResults: WeChatImageParseResult[],
  totalImageCount: number
) {
  const sections = [bodyContent.trim()];

  if (totalImageCount > 0) {
    const imageSectionLines = [
      "## 正文图片解析结果",
      "",
      `检测到 ${totalImageCount} 张正文图片，已尝试解析前 ${Math.min(
        totalImageCount,
        MAX_WECHAT_IMAGES
      )} 张。`,
    ];

    imageResults.forEach((result, index) => {
      imageSectionLines.push("", `### 图片 ${index + 1}`, `图片 URL: ${result.url}`);

      if (result.content) {
        imageSectionLines.push("", result.content);
      } else {
        imageSectionLines.push("", `图片解析失败：${result.error || "unknown error"}`);
      }
    });

    if (totalImageCount > MAX_WECHAT_IMAGES) {
      imageSectionLines.push(
        "",
        `还有 ${totalImageCount - MAX_WECHAT_IMAGES} 张图片未解析，以控制导入成本。`
      );
    }

    sections.push(imageSectionLines.join("\n"));
  }

  return sections.filter(Boolean).join("\n\n").trim();
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
      "[admin/parse-url] AI metadata JSON parse failed:",
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

function fallbackTitle(pageTitle: string, content: string) {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return pageTitle || firstLine?.slice(0, 80) || "Imported Web Page";
}

function buildExtractionPrompt(content: string, pageTitle: string, sourceUrl: string) {
  return [
    "You are a metadata extraction assistant for a HKUST freshman knowledge base.",
    "",
    "Given cleaned web page content, extract structured metadata for importing it into a RAG knowledge base.",
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
    `Page title: ${pageTitle}`,
    `Source URL: ${sourceUrl}`,
    "",
    "Cleaned web page content:",
    content.slice(0, 6000),
  ].join("\n");
}

async function generateMetadata(content: string, pageTitle: string, sourceUrl: string) {
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
            content: buildExtractionPrompt(content, pageTitle, sourceUrl),
          },
        ],
      },
      { timeout: METADATA_EXTRACTION_TIMEOUT_MS }
    ),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Metadata extraction timed out.")),
        METADATA_EXTRACTION_TIMEOUT_MS
      );
    }),
  ]);

  return safeParseGeneratedMetadata(completion.choices[0]?.message?.content ?? "");
}

function sourceName(url: URL, pageTitle: string) {
  return pageTitle || url.hostname.replace(/^www\./, "");
}

export const Route = createFileRoute("/api/admin/parse-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as
          | ParseUrlPayload
          | null;

        let url: URL;

        try {
          url = parseHttpUrl(body?.url);
          await assertUrlIsPublic(url);
        } catch (error) {
          return json(
            { error: error instanceof Error ? error.message : "Invalid URL." },
            { status: 400 }
          );
        }

        try {
          const response = await fetchPublicUrl(url);

          if (!response.ok) {
            return json(
              { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
              { status: 400 }
            );
          }

          const contentType = response.headers.get("content-type") ?? "";

          if (
            contentType &&
            !contentType.includes("text/html") &&
            !contentType.includes("text/plain") &&
            !contentType.includes("application/xhtml")
          ) {
            return json(
              { error: `Unsupported content type: ${contentType}` },
              { status: 400 }
            );
          }

          const rawText = await readLimitedText(response);

          if (isWeChatArticleUrl(url)) {
            const article = extractWeChatArticle(rawText, url);
            const abnormalMessage = getWeChatAbnormalMessage(
              rawText,
              article.title,
              article.content
            );

            if (abnormalMessage) {
              return json({ error: abnormalMessage }, { status: 400 });
            }

            const imageResults =
              article.imageUrls.length > 0
                ? await parseWeChatImages(article.imageUrls)
                : [];
            const content = buildWeChatContent(
              article.content,
              imageResults,
              article.imageUrls.length
            );

            if (content.length < 40) {
              return json(
                {
                  error:
                    "WeChat article content is too short after cleaning. The article may be unavailable or access-restricted.",
                },
                { status: 400 }
              );
            }

            let metadata: GeneratedMetadata = {};

            try {
              metadata = await generateMetadata(content, article.title, url.toString());
            } catch (error) {
              console.warn(
                "[admin/parse-url] WeChat metadata generation failed:",
                error instanceof Error ? error.message : error
              );
            }

            const duplicateReview = await reviewSemanticDuplicates({ content });
            const finalResponse = {
              title:
                getString(metadata.title) ||
                article.title ||
                extractFirstNonEmptyLine(article.content)?.slice(0, 80) ||
                "Imported WeChat Article",
              category: normalizeCategory(metadata.category),
              source: article.accountName || "WeChat Article",
              source_url: url.toString(),
              source_type: "wechat_url" as const,
              updatedAt: getTodayDate(),
              keywords: normalizeKeywords(metadata.keywords),
              summary:
                getString(metadata.summary) ||
                article.content.slice(0, 180).replace(/\s+/g, " ").trim(),
              content,
              duplicate_review: duplicateReview,
            };

            return json(finalResponse);
          }

          const { title: pageTitle, content } = extractPageContent(
            rawText,
            contentType
          );

          if (content.length < 40) {
            return json(
              { error: "Fetched page content is too short to import." },
              { status: 400 }
            );
          }

          let metadata: GeneratedMetadata = {};

          try {
            metadata = await generateMetadata(content, pageTitle, url.toString());
          } catch (error) {
            console.warn(
              "[admin/parse-url] Metadata generation failed:",
              error instanceof Error ? error.message : error
            );
          }

          const duplicateReview = await reviewSemanticDuplicates({ content });
          const finalResponse = {
            title: getString(metadata.title) || fallbackTitle(pageTitle, content),
            category: normalizeCategory(metadata.category),
            source: sourceName(url, pageTitle),
            source_url: url.toString(),
            source_type: "web_url" as const,
            updatedAt: getTodayDate(),
            keywords: normalizeKeywords(metadata.keywords),
            summary:
              getString(metadata.summary) ||
              content.slice(0, 180).replace(/\s+/g, " ").trim(),
            content,
            duplicate_review: duplicateReview,
          };

          return json(finalResponse);
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to parse URL.",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
