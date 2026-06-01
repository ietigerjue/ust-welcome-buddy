import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "http://localhost:8080";
const DEFAULT_TEST_URLS = [
  "https://example.com",
  "https://www.hkust.edu.hk",
];

type ParseUrlResponse = {
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

function getBaseUrl() {
  return (process.env.URL_PARSE_API_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

function getTestUrls() {
  return (process.env.URL_PARSE_TEST_URLS?.split(",") ?? DEFAULT_TEST_URLS)
    .map((url) => url.trim())
    .filter(Boolean);
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as ParseUrlResponse;
}

function assertParseResult(url: string, data: ParseUrlResponse) {
  const missing: string[] = [];

  for (const key of [
    "title",
    "category",
    "source",
    "source_url",
    "source_type",
    "updatedAt",
    "summary",
    "content",
  ] as const) {
    if (!data[key]) {
      missing.push(key);
    }
  }

  if (!Array.isArray(data.keywords)) {
    missing.push("keywords");
  }

  if (!["web_url", "wechat_url"].includes(data.source_type ?? "")) {
    missing.push("source_type=web_url|wechat_url");
  }

  if (missing.length > 0) {
    throw new Error(`${url} missing fields: ${missing.join(", ")}`);
  }
}

async function main() {
  await loadLocalEnv();

  const adminToken = process.env.ADMIN_IMPORT_TOKEN;

  if (!adminToken) {
    throw new Error("Missing ADMIN_IMPORT_TOKEN in .env.local or environment.");
  }

  const endpoint = `${getBaseUrl()}/api/admin/parse-url`;
  const urls = getTestUrls();
  const failed: string[] = [];

  console.log("[test:url-parse] endpoint:", endpoint);
  console.log("[test:url-parse] total URLs:", urls.length);

  for (const url of urls) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ url }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data.error || "URL parse failed."}`
        );
      }

      assertParseResult(url, data);

      console.log("[test:url-parse] PASS", {
        url,
        title: data.title,
        category: data.category,
        source: data.source,
        source_type: data.source_type,
        keywordsCount: data.keywords?.length ?? 0,
        contentLength: data.content?.length ?? 0,
      });
    } catch (error) {
      failed.push(url);
      console.error("[test:url-parse] FAIL", {
        url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("[test:url-parse] summary:", {
    total: urls.length,
    passed: urls.length - failed.length,
    failed: failed.length,
    failedUrls: failed,
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[test:url-parse] failed:", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
  });
  process.exitCode = 1;
});
