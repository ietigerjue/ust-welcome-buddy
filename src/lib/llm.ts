import type { KnowledgeDocument } from "@/data/knowledgeBase";

type GenerateAnswerArgs = {
  question: string;
  contextDocuments: KnowledgeDocument[];
};

type LlmProvider = "mock" | "minimax";

type LlmConfig = {
  provider: LlmProvider;
  minimaxApiKey?: string;
  minimaxBaseUrl?: string;
  minimaxModel?: string;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function getEnv(name: string) {
  const processEnv = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];
  const value = processEnv ?? import.meta.env[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getLlmConfig(): LlmConfig {
  const provider = getEnv("LLM_PROVIDER");

  return {
    provider: provider === "minimax" ? "minimax" : "mock",
    minimaxApiKey: getEnv("MINIMAX_API_KEY"),
    minimaxBaseUrl: getEnv("MINIMAX_BASE_URL"),
    minimaxModel: getEnv("MINIMAX_MODEL"),
  };
}

export async function generateAnswer({
  question,
  contextDocuments,
}: GenerateAnswerArgs) {
  const config = getLlmConfig();
  const documentCount = contextDocuments.length;

  if (config.provider === "minimax") {
    return (
      `我在本地知識庫中找到了 ${documentCount} 篇相關資料。` +
      "\n\n" +
      "MiniMax provider is selected, but the real MiniMax API call is not connected yet. This is still a mock answer."
    );
  }

  return (
    `我在本地知識庫中找到了 ${documentCount} 篇相關資料。` +
    "\n\n" +
    `This is a mock answer for: "${question}". The response is generated from local knowledge base matches only; no external LLM API is called.`
  );
}
