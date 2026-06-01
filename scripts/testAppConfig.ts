import fs from "node:fs/promises";
import path from "node:path";
import {
  getAppConfig,
  getConfigEnvStatus,
  MODEL_CONFIG_KEYS,
} from "../src/lib/appConfig";

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

async function main() {
  await loadLocalEnv();

  const appConfig = await getAppConfig();

  console.log("[app_config] loaded keys:", MODEL_CONFIG_KEYS.join(", "));

  for (const key of MODEL_CONFIG_KEYS) {
    const item = appConfig[key];
    const envStatus = getConfigEnvStatus(item);

    console.log(`[app_config] ${key}`, {
      provider: item.provider,
      model: item.model,
      base_url_env: item.base_url_env,
      api_key_env: item.api_key_env,
      source: item.source,
      missingFields: item.missingFields,
      baseUrlEnvExists: envStatus.baseUrlEnvExists,
      apiKeyEnvExists: envStatus.apiKeyEnvExists,
    });
  }
}

main().catch((error) => {
  console.error("[app_config] test failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
  });
  process.exit(1);
});
