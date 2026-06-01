import {
  getModelConfig,
  type ModelConfigKey,
  type ModelProviderConfig,
} from "./appConfig";

const DEFAULT_IMAGE_PARSER_ENDPOINT = "/v1/coding_plan/vlm";
export const MISSING_PROVIDER_ENV_MESSAGE =
  "Provider is configured but required environment variable is missing.";

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type LlmConfigKey = Extract<ModelConfigKey, "chat_llm" | "metadata_llm">;

export type RoutedProviderKind =
  | "chat_llm"
  | "metadata_llm"
  | "embedding"
  | "image_parser";

export type RoutedProvider = {
  kind: RoutedProviderKind;
  provider: string;
  model: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  source: ModelProviderConfig["source"];
  missingFields: string[];
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
};

export type LLMProvider = RoutedProvider & {
  kind: LlmConfigKey;
  interface: "chat_completions";
};

export type EmbeddingProvider = RoutedProvider & {
  kind: "embedding";
  interface: "embeddings";
  dimensions?: number;
};

export type ImageParserProvider = RoutedProvider & {
  kind: "image_parser";
  interface: "image_parser";
  endpoint: string;
  fallbackProvider?: string;
};

export type ProviderRuntime = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  endpoint?: string;
  dimensions?: number;
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

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getConfiguredBaseUrl(config: ModelProviderConfig) {
  return getEnv(config.base_url_env);
}

function getConfiguredApiKey(config: ModelProviderConfig) {
  return getEnv(config.api_key_env);
}

async function getRoutedProvider(
  kind: RoutedProviderKind
): Promise<RoutedProvider> {
  const config = await getModelConfig(kind);
  const baseUrl = getConfiguredBaseUrl(config);
  const apiKey = getConfiguredApiKey(config);

  return {
    kind,
    provider: config.provider || "unknown",
    model: config.model || "",
    baseUrlEnv: config.base_url_env,
    apiKeyEnv: config.api_key_env,
    source: config.source,
    missingFields: config.missingFields,
    baseUrlConfigured: Boolean(baseUrl),
    apiKeyConfigured: Boolean(apiKey),
  };
}

export async function getLLMProvider(
  kind: LlmConfigKey = "chat_llm"
): Promise<LLMProvider> {
  const provider = await getRoutedProvider(kind);

  return {
    ...provider,
    kind,
    interface: "chat_completions",
  };
}

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  const provider = await getRoutedProvider("embedding");
  const config = await getModelConfig("embedding");

  return {
    ...provider,
    kind: "embedding",
    interface: "embeddings",
    dimensions:
      config.dimensions ?? parsePositiveInteger(getEnv("EMBEDDING_DIMENSIONS")),
  };
}

export async function getImageParserProvider(): Promise<ImageParserProvider> {
  const provider = await getRoutedProvider("image_parser");
  const config = await getModelConfig("image_parser");

  return {
    ...provider,
    kind: "image_parser",
    interface: "image_parser",
    endpoint:
      (config.endpoint_env ? getEnv(config.endpoint_env) : undefined) ??
      getEnv("IMAGE_PARSE_ENDPOINT") ??
      getEnv("MINIMAX_VLM_ENDPOINT") ??
      DEFAULT_IMAGE_PARSER_ENDPOINT,
    fallbackProvider: config.fallback_provider,
  };
}

export function resolveProviderRuntime(
  provider: LLMProvider | EmbeddingProvider | ImageParserProvider
): ProviderRuntime {
  const configuredBaseUrl = getEnv(provider.baseUrlEnv);

  return {
    apiKey: getEnv(provider.apiKeyEnv),
    baseUrl: configuredBaseUrl,
    model: provider.model,
    endpoint: "endpoint" in provider ? provider.endpoint : undefined,
    dimensions: "dimensions" in provider ? provider.dimensions : undefined,
  };
}

export function getMissingProviderEnvironmentKeys(
  provider: LLMProvider | EmbeddingProvider | ImageParserProvider,
  runtime: ProviderRuntime = resolveProviderRuntime(provider)
) {
  return [
    [provider.apiKeyEnv, runtime.apiKey],
    [provider.baseUrlEnv, runtime.baseUrl],
  ]
    .filter(([key, value]) => key && !value)
    .map(([key]) => key);
}

export function getMissingProviderRuntimeKeys(
  provider: LLMProvider | EmbeddingProvider | ImageParserProvider,
  runtime: ProviderRuntime = resolveProviderRuntime(provider)
) {
  const missingKeys = getMissingProviderEnvironmentKeys(provider, runtime);

  if (provider.kind !== "image_parser") {
    if (!runtime.model) {
      missingKeys.push("model");
    }
  }

  return missingKeys;
}

export function getProviderRuntimeErrorMessage(
  provider: LLMProvider | EmbeddingProvider | ImageParserProvider,
  runtime: ProviderRuntime = resolveProviderRuntime(provider)
) {
  const missingEnvironmentKeys = getMissingProviderEnvironmentKeys(
    provider,
    runtime
  );

  if (missingEnvironmentKeys.length > 0) {
    return `${MISSING_PROVIDER_ENV_MESSAGE} Missing: ${missingEnvironmentKeys.join(
      ", "
    )}.`;
  }

  if (provider.kind !== "image_parser" && !runtime.model) {
    return "Provider is configured but model is missing.";
  }

  return "";
}

export function assertProviderRuntimeConfigured(
  provider: LLMProvider | EmbeddingProvider | ImageParserProvider,
  runtime: ProviderRuntime = resolveProviderRuntime(provider)
) {
  const message = getProviderRuntimeErrorMessage(provider, runtime);

  if (message) {
    throw new Error(message);
  }
}
