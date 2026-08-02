import { getSupabaseServerClient } from "./supabaseServer";

export const MODEL_CONFIG_KEYS = [
  "chat_llm",
  "metadata_llm",
  "image_parser",
  "embedding",
] as const;

export type ModelConfigKey = (typeof MODEL_CONFIG_KEYS)[number];

export type ModelProviderConfig = {
  provider: string;
  model: string;
  base_url_env: string;
  api_key_env: string;
  endpoint_env?: string;
  dimensions?: number;
  fallback_provider?: string;
  enabled?: boolean;
  source: "supabase" | "env_default";
  missingFields: string[];
};

export type AppConfig = Record<ModelConfigKey, ModelProviderConfig>;

type AppConfigRow = {
  key: string;
  value: unknown;
};

type RawProviderConfig = {
  provider?: unknown;
  model?: unknown;
  base_url_env?: unknown;
  api_key_env?: unknown;
  endpoint_env?: unknown;
  dimensions?: unknown;
  fallback_provider?: unknown;
  enabled?: unknown;
};

const REQUIRED_FIELDS = [
  "provider",
  "model",
  "base_url_env",
  "api_key_env",
] as const;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function textOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function numberOrFallback(value: unknown, fallback?: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function booleanOrFallback(value: unknown, fallback?: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function isModelConfigKey(value: string): value is ModelConfigKey {
  return MODEL_CONFIG_KEYS.includes(value as ModelConfigKey);
}

function buildConfig(
  fallback: Omit<ModelProviderConfig, "source" | "missingFields">,
  raw?: RawProviderConfig,
): ModelProviderConfig {
  const config = {
    provider: textOrFallback(raw?.provider, fallback.provider),
    model: textOrFallback(raw?.model, fallback.model),
    base_url_env: textOrFallback(raw?.base_url_env, fallback.base_url_env),
    api_key_env: textOrFallback(raw?.api_key_env, fallback.api_key_env),
    endpoint_env: optionalText(raw?.endpoint_env) ?? fallback.endpoint_env,
    dimensions: numberOrFallback(raw?.dimensions, fallback.dimensions),
    fallback_provider:
      optionalText(raw?.fallback_provider) ?? fallback.fallback_provider,
    enabled: booleanOrFallback(raw?.enabled, fallback.enabled),
  };

  return {
    ...config,
    source: raw ? "supabase" : "env_default",
    missingFields: REQUIRED_FIELDS.filter((field) => config[field].length === 0),
  };
}

export function getDefaultAppConfig(): AppConfig {
  const chatProvider =
    env("CHAT_LLM_PROVIDER") ||
    env("LLM_PROVIDER") ||
    (env("DEEPSEEK_API_KEY") ? "deepseek" : "minimax");
  const metadataProvider =
    env("METADATA_LLM_PROVIDER") ||
    env("LLM_PROVIDER") ||
    (env("DEEPSEEK_API_KEY") ? "deepseek" : "minimax");

  return {
    chat_llm: buildConfig({
      provider: chatProvider,
      model:
        env("CHAT_LLM_MODEL") ||
        (chatProvider === "deepseek" ? env("DEEPSEEK_MODEL") : "") ||
        env("MINIMAX_MODEL") ||
        env("DEEPSEEK_MODEL"),
      base_url_env:
        env("CHAT_LLM_BASE_URL_ENV") ||
        (chatProvider === "deepseek" ? "DEEPSEEK_BASE_URL" : "MINIMAX_BASE_URL"),
      api_key_env:
        env("CHAT_LLM_API_KEY_ENV") ||
        (chatProvider === "deepseek" ? "DEEPSEEK_API_KEY" : "MINIMAX_API_KEY"),
      enabled: true,
    }),
    metadata_llm: buildConfig({
      provider: metadataProvider,
      model:
        env("METADATA_LLM_MODEL") ||
        (metadataProvider === "deepseek" ? env("DEEPSEEK_MODEL") : "") ||
        env("MINIMAX_MODEL") ||
        env("DEEPSEEK_MODEL"),
      base_url_env:
        env("METADATA_LLM_BASE_URL_ENV") ||
        (metadataProvider === "deepseek"
          ? "DEEPSEEK_BASE_URL"
          : "MINIMAX_BASE_URL"),
      api_key_env:
        env("METADATA_LLM_API_KEY_ENV") ||
        (metadataProvider === "deepseek"
          ? "DEEPSEEK_API_KEY"
          : "MINIMAX_API_KEY"),
      enabled: true,
    }),
    image_parser: buildConfig({
      provider: env("IMAGE_PARSE_PROVIDER") || "minimax_vlm",
      model: env("IMAGE_PARSE_MODEL") || env("MINIMAX_VLM_MODEL"),
      base_url_env: env("IMAGE_PARSE_BASE_URL_ENV") || "MINIMAX_VLM_BASE_URL",
      api_key_env: env("IMAGE_PARSE_API_KEY_ENV") || "MINIMAX_VLM_API_KEY",
      endpoint_env: env("IMAGE_PARSE_ENDPOINT_ENV") || "MINIMAX_VLM_ENDPOINT",
      fallback_provider: env("IMAGE_PARSE_FALLBACK_PROVIDER") || "ocr",
      enabled: true,
    }),
    embedding: buildConfig({
      provider: env("EMBEDDING_PROVIDER") || "jina",
      model: env("EMBEDDING_MODEL"),
      base_url_env: env("EMBEDDING_BASE_URL_ENV") || "EMBEDDING_BASE_URL",
      api_key_env: env("EMBEDDING_API_KEY_ENV") || "EMBEDDING_API_KEY",
      dimensions: numberOrFallback(env("EMBEDDING_DIMENSIONS")),
      enabled: true,
    }),
  };
}

export async function getAppConfig(): Promise<AppConfig> {
  const defaults = getDefaultAppConfig();
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return defaults;
  }

  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", [...MODEL_CONFIG_KEYS]);

    if (error) {
      console.warn("[app_config] Supabase config unavailable, using env defaults", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return defaults;
    }

    const merged: AppConfig = { ...defaults };

    for (const row of (data ?? []) as AppConfigRow[]) {
      if (!isModelConfigKey(row.key)) {
        continue;
      }

      const fallback = defaults[row.key];
      merged[row.key] = buildConfig(fallback, row.value as RawProviderConfig);
    }

    return merged;
  } catch (error) {
    console.warn("[app_config] Failed to read Supabase config, using env defaults", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined,
    });
    return defaults;
  }
}

export async function getModelConfig(
  key: ModelConfigKey,
): Promise<ModelProviderConfig> {
  const config = await getAppConfig();
  return config[key];
}

export function getConfigEnvStatus(config: ModelProviderConfig) {
  return {
    baseUrlEnvExists: Boolean(env(config.base_url_env)),
    apiKeyEnvExists: Boolean(env(config.api_key_env)),
  };
}
