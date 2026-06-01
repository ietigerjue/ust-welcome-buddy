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
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!isMissingFile) {
        throw error;
      }
    }
  }
}

function getApiBaseUrl() {
  return (process.env.ADMIN_CONFIG_API_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function assertConfigShape(config: Record<string, unknown>) {
  for (const key of ["chat_llm", "metadata_llm", "image_parser", "embedding"]) {
    if (!config[key] || typeof config[key] !== "object") {
      throw new Error(`Missing config section: ${key}`);
    }

    const section = config[key] as Record<string, unknown>;

    if (typeof section.api_key_env !== "string") {
      throw new Error(`Missing api_key_env in section: ${key}`);
    }

    if (typeof section.keyConfigured !== "boolean") {
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
  const headers = {
    "Content-Type": "application/json",
    "x-admin-token": adminToken,
  };

  console.log("[test:admin-config] GET config:", url);

  const getResponse = await fetch(url, {
    method: "GET",
    headers,
  });
  const currentConfig = await readJson(getResponse);

  if (!getResponse.ok) {
    throw new Error(
      `GET /api/admin/config failed: ${getResponse.status} ${JSON.stringify(
        currentConfig
      )}`
    );
  }

  assertConfigShape(currentConfig);
  console.log("[test:admin-config] GET success:", {
    keys: Object.keys(currentConfig).filter((key) => key !== "warnings"),
  });

  console.log("[test:admin-config] verifying secret-field rejection");
  const forbiddenResponse = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      ...currentConfig,
      chat_llm: {
        ...(currentConfig.chat_llm as Record<string, unknown>),
        api_key: "should-not-save",
      },
    }),
  });
  const forbiddenBody = await readJson(forbiddenResponse);

  if (forbiddenResponse.status !== 400) {
    throw new Error(
      `Expected forbidden api_key field to return 400, got ${
        forbiddenResponse.status
      }: ${JSON.stringify(forbiddenBody)}`
    );
  }

  console.log("[test:admin-config] forbidden field rejected:", {
    status: forbiddenResponse.status,
    error: forbiddenBody.error,
  });

  console.log("[test:admin-config] verifying raw secret value rejection");
  const rawSecretResponse = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      ...currentConfig,
      chat_llm: {
        ...(currentConfig.chat_llm as Record<string, unknown>),
        api_key_env: "sk-should-not-save",
      },
    }),
  });
  const rawSecretBody = await readJson(rawSecretResponse);

  if (rawSecretResponse.status !== 400) {
    throw new Error(
      `Expected raw secret-like api_key_env value to return 400, got ${
        rawSecretResponse.status
      }: ${JSON.stringify(rawSecretBody)}`
    );
  }

  console.log("[test:admin-config] raw secret value rejected:", {
    status: rawSecretResponse.status,
    error: rawSecretBody.error,
  });

  console.log("[test:admin-config] PUT current config back");
  const putResponse = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(currentConfig),
  });
  const savedConfig = await readJson(putResponse);

  if (!putResponse.ok) {
    throw new Error(
      `PUT /api/admin/config failed: ${putResponse.status} ${JSON.stringify(
        savedConfig
      )}`
    );
  }

  assertConfigShape(savedConfig);
  console.log("[test:admin-config] PUT success:", {
    warnings: savedConfig.warnings ?? [],
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
