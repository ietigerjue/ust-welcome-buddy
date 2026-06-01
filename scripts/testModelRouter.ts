import fs from "node:fs/promises";
import path from "node:path";
import {
  getEmbeddingProvider,
  getImageParserProvider,
  getLLMProvider,
  getMissingProviderRuntimeKeys,
  getProviderRuntimeErrorMessage,
  MISSING_PROVIDER_ENV_MESSAGE,
  resolveProviderRuntime,
  type EmbeddingProvider,
  type ImageParserProvider,
  type LLMProvider,
} from "../src/lib/modelRouter";

type ProviderForTest = LLMProvider | EmbeddingProvider | ImageParserProvider;

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

function describeProvider(provider: ProviderForTest) {
  const runtime = resolveProviderRuntime(provider);
  const missingRuntimeKeys = getMissingProviderRuntimeKeys(provider, runtime);

  return {
    kind: provider.kind,
    interface: provider.interface,
    provider: provider.provider,
    model: provider.model,
    source: provider.source,
    baseUrlEnv: provider.baseUrlEnv,
    apiKeyEnv: provider.apiKeyEnv,
    baseUrlConfigured: Boolean(runtime.baseUrl),
    apiKeyConfigured: Boolean(runtime.apiKey),
    missingFields: provider.missingFields,
    missingRuntimeKeys,
    dimensions: "dimensions" in provider ? provider.dimensions : undefined,
    endpoint: "endpoint" in provider ? provider.endpoint : undefined,
  };
}

async function main() {
  await loadLocalEnv();

  const providers: ProviderForTest[] = [
    await getLLMProvider("chat_llm"),
    await getLLMProvider("metadata_llm"),
    await getEmbeddingProvider(),
    await getImageParserProvider(),
  ];

  for (const provider of providers) {
    console.log("[test:model-router] provider:", describeProvider(provider));
  }

  const invalidProviders = providers.filter(
    (provider) => !provider.kind || !provider.interface || !provider.provider
  );

  if (invalidProviders.length > 0) {
    throw new Error(
      `Model router returned invalid provider descriptors: ${invalidProviders
        .map((provider) => provider.kind || "unknown")
        .join(", ")}`
    );
  }

  const missingEnvMessage = getProviderRuntimeErrorMessage({
    kind: "chat_llm",
    interface: "chat_completions",
    provider: "test",
    model: "test-model",
    baseUrlEnv: "TEST_MISSING_BASE_URL_FOR_ROUTER",
    apiKeyEnv: "TEST_MISSING_API_KEY_FOR_ROUTER",
    source: "env_default",
    missingFields: [],
    baseUrlConfigured: false,
    apiKeyConfigured: false,
  });

  if (!missingEnvMessage.startsWith(MISSING_PROVIDER_ENV_MESSAGE)) {
    throw new Error(
      `Expected missing environment message, got: ${missingEnvMessage}`
    );
  }

  console.log("[test:model-router] done:", {
    total: providers.length,
    checked: providers.map((provider) => provider.kind),
  });
}

main().catch((error) => {
  console.error("[test:model-router] failed:", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
  });
  process.exitCode = 1;
});
