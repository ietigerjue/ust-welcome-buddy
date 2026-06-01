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
import { getSupabaseServerClient } from "../src/lib/supabaseServer";

type TestStatus = "pass" | "fail";

type RawAppConfigRow = {
  key: string;
  value: unknown;
};

type Result = {
  id: string;
  status: TestStatus;
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
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";

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

  if (!config.provider) {
    errors.push(`${key}.provider is missing.`);
  }

  if (!config.base_url_env) {
    errors.push(`${key}.base_url_env is missing.`);
  }

  if (!config.api_key_env) {
    errors.push(`${key}.api_key_env is missing.`);
  }

  if (key === "chat_llm" && !config.model) {
    errors.push("chat_llm.model is missing.");
  }

  if (key === "embedding") {
    if (!config.model) {
      errors.push("embedding.model is missing.");
    }

    if (!config.dimensions || config.dimensions <= 0) {
      errors.push("embedding.dimensions must be a positive integer.");
    }
  }

  if (config.base_url_env && !envStatus.baseUrlEnvExists) {
    errors.push(
      `${key}.${config.base_url_env} is not configured in the environment.`
    );
  }

  if (config.api_key_env && !envStatus.apiKeyEnvExists) {
    errors.push(
      `${key}.${config.api_key_env} is not configured in the environment.`
    );
  }

  return errors;
}

function printResult(result: Result) {
  const prefix = result.status === "pass" ? "PASS" : "FAIL";
  console.log(`[test:model-config] ${prefix} ${result.id}: ${result.message}`);
}

async function fetchRawAppConfigRows() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error(
      "Supabase server client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { data, error } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", [...MODEL_CONFIG_KEYS]);

  if (error) {
    throw new Error(
      `Failed to read app_config from Supabase: ${error.message}`
    );
  }

  return {
    supabase,
    rows: ((data ?? []) as RawAppConfigRow[]).filter((row) =>
      MODEL_CONFIG_KEYS.includes(row.key as ModelConfigKey)
    ),
  };
}

async function restoreChatConfig(
  originalRow: RawAppConfigRow | undefined,
  supabase: ReturnType<typeof getSupabaseServerClient>
) {
  if (!supabase) {
    return;
  }

  if (originalRow) {
    const { error } = await supabase
      .from("app_config")
      .upsert(
        {
          key: "chat_llm",
          value: originalRow.value,
        },
        { onConflict: "key" }
      );

    if (error) {
      throw new Error(`Failed to restore chat_llm config: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase
    .from("app_config")
    .delete()
    .eq("key", "chat_llm");

  if (error) {
    throw new Error(`Failed to remove temporary chat_llm config: ${error.message}`);
  }
}

async function verifyConfigOverrideRoundTrip() {
  const { supabase, rows } = await fetchRawAppConfigRows();
  const originalRow = rows.find((row) => row.key === "chat_llm");
  const before = await getModelConfig("chat_llm");
  const marker = `qa-test-${Date.now()}`;
  const testConfig = {
    provider: marker,
    model: `${marker}-model`,
    base_url_env: before.base_url_env || "MINIMAX_BASE_URL",
    api_key_env: before.api_key_env || "MINIMAX_API_KEY",
    endpoint_env: before.endpoint_env,
    dimensions: before.dimensions,
    fallback_provider: before.fallback_provider,
    enabled: before.enabled ?? true,
  };

  try {
    const { error } = await supabase
      .from("app_config")
      .upsert(
        {
          key: "chat_llm",
          value: testConfig,
        },
        { onConflict: "key" }
      );

    if (error) {
      throw new Error(`Failed to upsert temporary chat_llm config: ${error.message}`);
    }

    const after = await getModelConfig("chat_llm");

    if (after.provider !== testConfig.provider || after.model !== testConfig.model) {
      throw new Error(
        `Expected updated chat_llm provider/model, got provider=${after.provider}, model=${after.model}`
      );
    }

    return {
      before: summarizeConfig("chat_llm", before),
      after: summarizeConfig("chat_llm", after),
    };
  } finally {
    await restoreChatConfig(originalRow, supabase);
  }
}

async function main() {
  await loadLocalEnv();

  const results: Result[] = [];
  const appConfig = await getAppConfig();

  console.log("[test:model-config] loaded app config:");

  for (const key of MODEL_CONFIG_KEYS) {
    const config = appConfig[key];
    const modelConfig = await getModelConfig(key);
    const summary = summarizeConfig(key, modelConfig);
    const errors = validateConfig(key, modelConfig);

    console.log(`[test:model-config] ${key}`, summary);

    results.push({
      id: `${key}:read`,
      status: config.provider === modelConfig.provider ? "pass" : "fail",
      message:
        config.provider === modelConfig.provider
          ? "getAppConfig() and getModelConfig() agree."
          : "getAppConfig() and getModelConfig() returned different provider values.",
    });

    results.push({
      id: `${key}:validate`,
      status: errors.length === 0 ? "pass" : "fail",
      message:
        errors.length === 0
          ? "required fields and environment variable names are present."
          : errors.join(" "),
    });
  }

  try {
    const roundTrip = await verifyConfigOverrideRoundTrip();

    console.log("[test:model-config] override round trip", roundTrip);
    results.push({
      id: "app_config:update-read-restore",
      status: "pass",
      message:
        "temporary chat_llm provider/model update was readable through getModelConfig() and restored.",
    });
  } catch (error) {
    results.push({
      id: "app_config:update-read-restore",
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
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
