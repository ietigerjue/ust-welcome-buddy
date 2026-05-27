import type { KnowledgeDocument } from "@/data/knowledgeBase";

const MAX_CONTEXT_DOCUMENTS = 3;
const MAX_DOCUMENT_CONTENT_LENGTH = 1200;

type GenerateAnswerArgs = {
  question: string;
  contextDocuments: KnowledgeDocument[];
};

type LlmConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
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

function getLlmConfig(): LlmConfig {
  return {
    apiKey: getEnv("MINIMAX_API_KEY"),
    baseUrl: getEnv("MINIMAX_BASE_URL"),
    model: getEnv("MINIMAX_MODEL"),
  };
}

function getMissingConfigKeys(config: LlmConfig) {
  return [
    ["MINIMAX_API_KEY", config.apiKey],
    ["MINIMAX_BASE_URL", config.baseUrl],
    ["MINIMAX_MODEL", config.model],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function buildContext(contextDocuments: KnowledgeDocument[]) {
  return contextDocuments
    .slice(0, MAX_CONTEXT_DOCUMENTS)
    .map((document, index) => {
      const content = document.content.slice(0, MAX_DOCUMENT_CONTENT_LENGTH);

      return [
        `Document ${index + 1}`,
        `Title: ${document.title}`,
        `Category: ${document.category}`,
        `Source: ${document.source}`,
        `Updated At: ${document.updatedAt}`,
        `Content: ${content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function getLanguageInstruction(question: string) {
  const hasChinese = /[\u3400-\u9fff]/.test(question);
  const hasEnglish = /[a-zA-Z]/.test(question);

  if (hasChinese && hasEnglish) {
    return "The user mixed Chinese and English. You may answer bilingually.";
  }

  if (hasChinese) {
    return "The user asked in Chinese. Answer in Chinese.";
  }

  return "The user asked in English. Answer in English.";
}

function sanitizeAnswer(answer: string) {
  return answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

const systemPrompt = [
  "You are UST Buddy, a friendly AI assistant for new HKUST students.",
  "Answer in a helpful, practical tone. Be concise and avoid unnecessary detail.",
  "Answer only from the provided contextDocuments. Do not use outside knowledge.",
  "Do not invent facts, links, locations, prices, deadlines, policies, or procedures that are not present in contextDocuments.",
  "If contextDocuments do not contain enough information to answer the question, clearly say: 当前知识库没有覆盖这个问题。",
  "Match the user's language: answer Chinese questions in Chinese, English questions in English, and mixed Chinese-English questions in a natural mixed style.",
  "Prefer this answer structure when the context is sufficient: direct answer, bullet points, Practical tip, Sources.",
  "Use localized section labels when appropriate, such as “直接回答 / 分点说明 / 实用建议 / Sources” for Chinese answers.",
  "In the Sources section, mention only document titles or source names from contextDocuments.",
  "For fees, visas, deadlines, housing rules, academic policies, official procedures, or other high-impact topics, remind the user to verify the latest details with official HKUST sources.",
  "Do not reveal chain-of-thought, hidden reasoning, or <think> tags.",
].join("\n");

export async function generateAnswer({
  question,
  contextDocuments,
}: GenerateAnswerArgs) {
  const config = getLlmConfig();
  const missingKeys = getMissingConfigKeys(config);

  if (missingKeys.length > 0) {
    return `MiniMax 配置缺失：${missingKeys.join(
      ", "
    )}。请在 .env.local 中配置后重启开发服务器。`;
  }

  const apiKey = config.apiKey ?? "";
  const baseUrl = config.baseUrl ?? "";
  const model = config.model ?? "";

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
          `Question: ${question}`,
          "",
          getLanguageInstruction(question),
          "",
          "contextDocuments:",
          buildContext(contextDocuments),
        ].join("\n"),
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return `MiniMax 请求失败：${message}`;
  }

  const answer = sanitizeAnswer(completion.choices[0]?.message?.content ?? "");

  if (!answer) {
    return "MiniMax 没有返回有效回答，请稍后再试。";
  }

  return answer;
}
