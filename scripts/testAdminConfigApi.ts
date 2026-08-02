import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "http://localhost:8080";

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
      const isMissingFile = error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!isMissingFile) {
        throw error;
      }
    }
  }
}

function getApiBaseUrl() {
  return (process.env.ADMIN_CONFIG_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function assertConfigShape(config: Record<string, unknown>) {
  if (config.managedBy !== "environment") {
    throw new Error("Expected config to be managed by environment variables.");
  }

  for (const key of ["chat_llm", "metadata_llm", "image_parser", "embedding"]) {
    const section = config[key];

    if (!section || typeof section !== "object") {
      throw new Error(`Missing config section: ${key}`);
    }

    const value = section as Record<string, unknown>;

    if (typeof value.api_key_env !== "string") {
      throw new Error(`Missing api_key_env in section: ${key}`);
    }

    if (typeof value.keyConfigured !== "boolean") {
      throw new Error(`Missing keyConfigured boolean in section: ${key}`);
    }
  }
}

async function main() {
  await loadLocalEnv();

  const adminToken = process.env.ADMIN_IMPORT_TOKEN;

  if (!adminToken) {
    throw new Error("Missing ADMIN_IMPORT_TOKEN in .env.local or environment.");
  }

  const url = `${getApiBaseUrl()}/api/admin/config`;
  const authorizedHeaders = {
    "Content-Type": "application/json",
    "x-admin-token": adminToken,
  };

  const unauthorizedResponse = await fetch(url, { method: "GET" });

  if (unauthorizedResponse.status !== 401) {
    throw new Error(`Expected unauthorized GET to return 401, got ${unauthorizedResponse.status}.`);
  }

  const getResponse = await fetch(url, {
    method: "GET",
    headers: authorizedHeaders,
  });
  const currentConfig = await readJson(getResponse);

  if (!getResponse.ok) {
    throw new Error(
      `GET /api/admin/config failed: ${getResponse.status} ${JSON.stringify(currentConfig)}`,
    );
  }

  assertConfigShape(currentConfig);
  console.log("[test:admin-config] GET environment config success");

  const putResponse = await fetch(url, {
    method: "PUT",
    headers: authorizedHeaders,
    body: JSON.stringify(currentConfig),
  });
  const putBody = await readJson(putResponse);

  if (putResponse.status !== 409) {
    throw new Error(
      `Expected environment-managed PUT to return 409, got ${putResponse.status}: ${JSON.stringify(
        putBody,
      )}`,
    );
  }

  console.log("[test:admin-config] PUT correctly disabled:", {
    status: putResponse.status,
    error: putBody.error,
  });
}

main().catch((error) => {
  console.error("[test:admin-config] failed:", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
  });
  process.exitCode = 1;
});
