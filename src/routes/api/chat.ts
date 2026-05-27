import { createFileRoute } from "@tanstack/react-router";
import { searchKnowledgeBase } from "@/lib/searchKnowledgeBase";

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

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const question = typeof body?.question === "string" ? body.question : "";
        const documents = searchKnowledgeBase(question);

        if (documents.length === 0) {
          return json({
            answer: "当前知识库没有覆盖这个问题。",
            sources: [],
          });
        }

        return json({
          answer:
            `我在本地知識庫中找到了 ${documents.length} 篇相關資料。` +
            "\n\n" +
            "This is a mock answer from /api/chat. MiniMax, OpenAI, database, and user upload are not connected.",
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
