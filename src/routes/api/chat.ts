import { createFileRoute } from "@tanstack/react-router";
import { searchKnowledgeBase } from "@/lib/searchKnowledgeBase";
import { generateAnswer } from "@/lib/llm";

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

        const answer = await generateAnswer({
          question,
          contextDocuments: documents,
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
