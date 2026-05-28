const DEFAULT_VLM_BASE_URL = "https://api.minimaxi.com";
const DEFAULT_VLM_ENDPOINT = "/v1/coding_plan/vlm";
const VLM_TIMEOUT_MS = 60000;

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type MiniMaxVlmResponse = Record<string, unknown>;

function getEnv(name: string) {
  const processEnv = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];
  const importMetaEnv = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env;
  const value = processEnv ?? importMetaEnv?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getVlmConfig() {
  return {
    apiKey: getEnv("MINIMAX_VLM_API_KEY"),
    baseUrl: getEnv("MINIMAX_VLM_BASE_URL") || DEFAULT_VLM_BASE_URL,
    endpoint: getEnv("MINIMAX_VLM_ENDPOINT") || DEFAULT_VLM_ENDPOINT,
  };
}

function joinUrl(baseUrl: string, endpoint: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

function preview(value: string) {
  return value.slice(0, 500);
}

function bufferToDataUrl(fileBuffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
}

function findContent(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const directContent = record.content;

  if (typeof directContent === "string" && directContent.trim()) {
    return directContent.trim();
  }

  const knownNestedKeys = ["data", "result", "output", "message"];

  for (const key of knownNestedKeys) {
    const nested = findContent(record[key]);

    if (nested) {
      return nested;
    }
  }

  if (Array.isArray(record.choices)) {
    for (const choice of record.choices) {
      const nested = findContent(choice);

      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

export function getImageParseProvider() {
  return getEnv("IMAGE_PARSE_PROVIDER") || "minimax_vlm";
}

export async function understandImageWithMiniMaxVlm(
  fileBuffer: Buffer,
  mimeType: string,
  prompt: string
) {
  const config = getVlmConfig();

  if (!config.apiKey) {
    throw new Error("MiniMax VLM API key is missing. Configure MINIMAX_VLM_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);

  try {
    const response = await fetch(joinUrl(config.baseUrl, config.endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: bufferToDataUrl(fileBuffer, mimeType),
      }),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let parsedBody: MiniMaxVlmResponse | null = null;

    try {
      parsedBody = rawBody ? (JSON.parse(rawBody) as MiniMaxVlmResponse) : null;
    } catch {
      parsedBody = null;
    }

    if (!response.ok) {
      throw new Error(
        `MiniMax VLM request failed (${response.status}): ${preview(rawBody)}`
      );
    }

    const content = findContent(parsedBody ?? rawBody);

    if (!content) {
      throw new Error(
        `MiniMax VLM response did not include content. Response preview: ${preview(rawBody)}`
      );
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("MiniMax VLM request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
