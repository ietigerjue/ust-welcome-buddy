import { createFileRoute } from "@tanstack/react-router";

type ChatSource = {
  id: string;
  title: string;
  snippet: string;
  source: string;
  updatedAt: string;
  category: string;
};

type ChatResponse = {
  answer: string;
  sources: ChatSource[];
};

function json(data: ChatResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getMiniMaxErrorMessage(answer: string) {
  const errorPrefixes = [
    "MiniMax 请求失败：",
    "MiniMax 配置缺失：",
    "MiniMax 没有返回有效回答",
  ];
  const matchedPrefix = errorPrefixes.find((prefix) =>
    answer.startsWith(prefix)
  );

  return matchedPrefix ? answer : undefined;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { searchKnowledgeBase } = await import("@/lib/searchKnowledgeBase");
        const { logQuestion } = await import("@/lib/questionLogs");
        const body = await request.json().catch(() => null);
        const question = typeof body?.question === "string" ? body.question : "";
        const documents = searchKnowledgeBase(question);

        if (documents.length === 0) {
          await logQuestion({
            question,
            answerStatus: "not_covered",
          });

          return json({
            answer: "当前知识库没有覆盖这个问题。",
            sources: [],
          });
        }

        const { generateAnswer } = await import("@/lib/llm");
        let answer: string;

        try {
          answer = await generateAnswer({
            question,
            contextDocuments: documents,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          answer = `MiniMax 请求失败：${message}`;
        }

        const errorMessage = getMiniMaxErrorMessage(answer);
        await logQuestion({
          question,
          answerStatus: errorMessage ? "error" : "answered",
          matchedSources: documents.map((document) => ({
            id: document.id,
            title: document.title,
            source: document.source,
            category: document.category,
            updatedAt: document.updatedAt,
          })),
          errorMessage,
        });

        return json({
          answer,
          sources: documents.map((document) => ({
            id: document.id,
            title: document.title,
            snippet: document.content,
            source: document.source,
            updatedAt: document.updatedAt,
            category: document.category,
          })),
        });
      },
    },
  },
});
