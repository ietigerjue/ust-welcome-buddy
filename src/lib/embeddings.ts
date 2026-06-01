import { Agent, ProxyAgent, setGlobalDispatcher } from "undici";
import {
  assertProviderRuntimeConfigured,
  getEmbeddingProvider,
  resolveProviderRuntime,
  type EmbeddingProvider,
} from "./modelRouter";

const EMBEDDING_TIMEOUT_MS = 30000;
let configuredDispatcherKey: string | undefined;

type ProcessLike = {
  env?: Record<string, string | undefined>;
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

function assertEmbeddingConfig(provider: EmbeddingProvider) {
  assertProviderRuntimeConfigured(provider);
}

function getEmbeddingEndpoint(baseUrl: string) {

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

function buildEmbeddingPayload(
  text: string,
  model: string,
  dimensions?: number
) {
  const payload: Record<string, unknown> = {
    model,
    input: [text],
  };

  if (dimensions) {
    payload.dimensions = dimensions;
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

  const provider = await getEmbeddingProvider();
  assertEmbeddingConfig(provider);
  const runtime = resolveProviderRuntime(provider);
  configureEmbeddingDispatcher();
  const endpoint = getEmbeddingEndpoint(runtime.baseUrl ?? "");

  console.log("[embeddings] request config:", {
    EMBEDDING_PROVIDER: provider.provider,
    EMBEDDING_BASE_URL: runtime.baseUrl,
    EMBEDDING_MODEL: runtime.model,
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
          Authorization: `Bearer ${runtime.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildEmbeddingPayload(input, runtime.model ?? "", runtime.dimensions)
        ),
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

    if (runtime.dimensions && embedding.length !== runtime.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${runtime.dimensions}, received ${embedding.length}.`
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
