import fs from "node:fs/promises";
import path from "node:path";
import {
  getAppConfig,
  getConfigEnvStatus,
  getModelConfig,
  MODEL_CONFIG_KEYS,
  type ModelConfigKey,
  type ModelProviderConfig,
} from "../src/lib/appConfig";

type Result = {
  id: string;
  status: "pass" | "fail";
  message: string;
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
      const isMissingFile = error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!isMissingFile) {
        throw error;
      }
    }
  }
}

function summarizeConfig(key: ModelConfigKey, config: ModelProviderConfig) {
  const envStatus = getConfigEnvStatus(config);

  return {
    key,
    provider: config.provider,
    model: config.model,
    base_url_env: config.base_url_env,
    api_key_env: config.api_key_env,
    endpoint_env: config.endpoint_env,
    dimensions: config.dimensions,
    fallback_provider: config.fallback_provider,
    enabled: config.enabled,
    source: config.source,
    missingFields: config.missingFields,
    baseUrlEnvExists: envStatus.baseUrlEnvExists,
    apiKeyEnvExists: envStatus.apiKeyEnvExists,
  };
}

function validateConfig(key: ModelConfigKey, config: ModelProviderConfig) {
  const errors: string[] = [];
  const envStatus = getConfigEnvStatus(config);

  if (config.source !== "env_default") {
    errors.push(`${key} is not environment-managed.`);
  }

  if (!config.provider) {
    errors.push(`${key}.provider is missing.`);
  }

  if (!config.model && key !== "image_parser") {
    errors.push(`${key}.model is missing.`);
  }

  if (!config.base_url_env || !envStatus.baseUrlEnvExists) {
    errors.push(`${key} base URL environment variable is missing.`);
  }

  if (!config.api_key_env || !envStatus.apiKeyEnvExists) {
    errors.push(`${key} API key environment variable is missing.`);
  }

  if (key === "embedding" && (!config.dimensions || config.dimensions <= 0)) {
    errors.push("embedding.dimensions must be a positive integer.");
  }

  return errors;
}

function printResult(result: Result) {
  const prefix = result.status === "pass" ? "PASS" : "FAIL";
  console.log(`[test:model-config] ${prefix} ${result.id}: ${result.message}`);
}

async function main() {
  await loadLocalEnv();

  const appConfig = await getAppConfig();
  const results: Result[] = [];

  for (const key of MODEL_CONFIG_KEYS) {
    const modelConfig = await getModelConfig(key);
    const errors = validateConfig(key, modelConfig);

    console.log(`[test:model-config] ${key}`, summarizeConfig(key, modelConfig));

    results.push({
      id: `${key}:env-source`,
      status:
        appConfig[key].source === "env_default" && modelConfig.source === "env_default"
          ? "pass"
          : "fail",
      message:
        modelConfig.source === "env_default"
          ? "runtime configuration is sourced from environment variables."
          : `unexpected config source: ${modelConfig.source}`,
    });

    results.push({
      id: `${key}:validate`,
      status: errors.length === 0 ? "pass" : "fail",
      message:
        errors.length === 0 ? "required environment configuration is present." : errors.join(" "),
    });
  }

  for (const result of results) {
    printResult(result);
  }

  const failed = results.filter((result) => result.status === "fail");

  console.log("[test:model-config] summary:", {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failedIds: failed.map((result) => result.id),
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[test:model-config] failed:", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
  });
  process.exitCode = 1;
});
