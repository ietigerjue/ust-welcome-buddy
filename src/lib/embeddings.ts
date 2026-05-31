import { Agent, ProxyAgent, setGlobalDispatcher } from "undici";

const DEFAULT_EMBEDDING_PROVIDER = "jina";
const DEFAULT_JINA_BASE_URL = "https://api.jina.ai/v1";
const EMBEDDING_TIMEOUT_MS = 30000;
let configuredDispatcherKey: string | undefined;

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type EmbeddingProvider = "jina" | "openai_compatible" | "minimax";

type EmbeddingConfig = {
  provider: EmbeddingProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
};

type EmbeddingResponse = {
  data?: Array<{
    embedding?: unknown;
  }>;
  embedding?: unknown;
  embeddings?: unknown;
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

function normalizeProvider(value: string | undefined): EmbeddingProvider {
  const provider = (value || DEFAULT_EMBEDDING_PROVIDER).toLowerCase();

  if (provider === "jina") {
    return "jina";
  }

  if (provider === "minimax") {
    return "minimax";
  }

  if (
    provider === "openai_compatible" ||
    provider === "openai-compatible" ||
    provider === "compatible"
  ) {
    return "openai_compatible";
  }

  throw new Error(
    `Unsupported EMBEDDING_PROVIDER: ${value}. Supported providers: jina, minimax, openai_compatible.`
  );
}

function parseDimensions(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const dimensions = Number.parseInt(value, 10);

  if (!Number.isFinite(dimensions) || dimensions <= 0) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  }

  return dimensions;
}

function getEmbeddingConfig(): EmbeddingConfig {
  const provider = normalizeProvider(getEnv("EMBEDDING_PROVIDER"));
  const baseUrl =
    getEnv("EMBEDDING_BASE_URL") ||
    (provider === "jina" ? DEFAULT_JINA_BASE_URL : undefined);

  return {
    provider,
    apiKey: getEnv("EMBEDDING_API_KEY"),
    baseUrl,
    model: getEnv("EMBEDDING_MODEL"),
    dimensions: parseDimensions(getEnv("EMBEDDING_DIMENSIONS")),
  };
}

function assertEmbeddingConfig(config: EmbeddingConfig) {
  const missingKeys = [
    ["EMBEDDING_API_KEY", config.apiKey],
    ["EMBEDDING_BASE_URL", config.baseUrl],
    ["EMBEDDING_MODEL", config.model],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Embedding configuration is missing: ${missingKeys.join(
        ", "
      )}. Please configure the embedding provider environment variables.`
    );
  }
}

function getEmbeddingEndpoint(config: EmbeddingConfig) {
  const baseUrl = config.baseUrl ?? "";

  return baseUrl.endsWith("/embeddings")
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, "")}/embeddings`;
}

function configureEmbeddingDispatcher() {
  const httpsProxy = getEnv("HTTPS_PROXY");
  const httpProxy = getEnv("HTTP_PROXY");
  const proxyUrl = httpsProxy || httpProxy;
  const dispatcherKey = proxyUrl ? `proxy:${proxyUrl}` : "direct";

  if (configuredDispatcherKey === dispatcherKey) {
    return;
  }

  if (proxyUrl) {
    setGlobalDispatcher(
      new ProxyAgent({
        uri: proxyUrl,
        connect: {
          timeout: EMBEDDING_TIMEOUT_MS,
        },
      })
    );

    console.log("[embeddings] proxy dispatcher enabled:", {
      proxyEnv: httpsProxy ? "HTTPS_PROXY" : "HTTP_PROXY",
      connectTimeoutMs: EMBEDDING_TIMEOUT_MS,
    });
  } else {
    setGlobalDispatcher(
      new Agent({
        connect: {
          timeout: EMBEDDING_TIMEOUT_MS,
        },
      })
    );
  }

  configuredDispatcherKey = dispatcherKey;
}

function buildEmbeddingPayload(text: string, config: EmbeddingConfig) {
  const payload: Record<string, unknown> = {
    model: config.model,
    input: [text],
  };

  if (config.dimensions) {
    payload.dimensions = config.dimensions;
  }

  return payload;
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function extractEmbedding(response: EmbeddingResponse) {
  const candidates = [
    response.data?.[0]?.embedding,
    response.embedding,
    Array.isArray(response.embeddings) ? response.embeddings[0] : undefined,
  ];

  for (const candidate of candidates) {
    if (isNumberArray(candidate)) {
      return candidate;
    }
  }

  throw new Error("Embedding provider did not return a valid embedding vector.");
}

function preview(value: string) {
  return value.slice(0, 500);
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: "cause" in error ? error.cause : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
    cause: undefined,
  };
}

function logFetchError(error: unknown) {
  const details = getErrorDetails(error);

  console.error("[embeddings] fetch exception:", {
    name: details.name,
    message: details.message,
    cause: details.cause,
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim();

  if (!input) {
    throw new Error("generateEmbedding requires non-empty text.");
  }

  const config = getEmbeddingConfig();
  assertEmbeddingConfig(config);
  configureEmbeddingDispatcher();
  const endpoint = getEmbeddingEndpoint(config);

  console.log("[embeddings] request config:", {
    EMBEDDING_PROVIDER: config.provider,
    EMBEDDING_BASE_URL: config.baseUrl,
    EMBEDDING_MODEL: config.model,
    textLength: input.length,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildEmbeddingPayload(input, config)),
        signal: controller.signal,
      });
    } catch (error) {
      logFetchError(error);
      throw error;
    }

    const rawBody = await response.text();

    if (!response.ok) {
      console.error("[embeddings] API error response:", {
        status: response.status,
        statusText: response.statusText,
        body: rawBody,
      });

      throw new Error(
        `Embedding request failed (${response.status} ${response.statusText}): ${preview(rawBody)}`
      );
    }

    let parsedBody: EmbeddingResponse;

    try {
      parsedBody = JSON.parse(rawBody) as EmbeddingResponse;
    } catch {
      throw new Error("Embedding provider returned invalid JSON.");
    }

    const embedding = extractEmbedding(parsedBody);

    if (config.dimensions && embedding.length !== config.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${config.dimensions}, received ${embedding.length}.`
      );
    }

    return embedding;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[embeddings] fetch exception:", {
        name: error.name,
        message: error.message,
        cause: "cause" in error ? error.cause : undefined,
      });
      throw new Error("Embedding request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
