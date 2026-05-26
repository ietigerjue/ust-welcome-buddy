import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { SiteNav } from "@/components/site-nav";
import { findMockAnswer, suggestedQuestions, type Source } from "@/lib/mock-data";
import { Send, Bot, User, BookOpen, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  pending?: boolean;
};

type ChatSearch = { q?: string };

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [{ title: "Chat — UST Buddy" }],
  }),
});

function ChatPage() {
  const { q } = Route.useSearch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const submittedFromQuery = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (q && !submittedFromQuery.current) {
      submittedFromQuery.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function send(question: string) {
    const text = question.trim();
    if (!text || sending) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const pendingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput("");
    setSending(true);

    setTimeout(() => {
      const { answer, sources } = findMockAnswer(text);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingMsg.id
            ? { ...msg, content: answer, sources, pending: false }
            : msg
        )
      );
      setSending(false);
    }, 800);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 flex flex-col">
        {messages.length === 0 ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="flex-1 py-8 space-y-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0 pt-6 pb-6"
        >
          <div className="relative rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask UST Buddy anything · 隨便問我"
              className="w-full bg-transparent px-5 py-4 pr-14 text-sm outline-none placeholder:text-muted-foreground"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Prototype — answers from mock knowledge base · 原型版本，使用模擬資料
          </p>
        </form>
      </main>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-5">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Hi, I'm UST Buddy</h1>
      <p className="mt-2 text-sm text-muted-foreground">你好，我是科大新生小助手</p>
      <p className="mt-4 max-w-md text-center text-sm text-muted-foreground">
        Ask me anything about settling into HKUST — arrival, housing, transport, food,
        SIM cards, banking, and more.
      </p>
      <div className="mt-8 w-full max-w-xl grid gap-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">Try asking:</p>
        {suggestedQuestions.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left text-sm rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-secondary/40 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("flex flex-col gap-2 max-w-[85%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border rounded-tl-sm"
          )}
        >
          {message.pending ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Searching knowledge base…</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none [&_p]:my-1.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 whitespace-pre-wrap">
              {renderMarkdownLite(message.content)}
            </div>
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.sources.map((s) => (
              <div
                key={s.id}
                className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-[11px]"
                title={s.snippet}
              >
                <BookOpen className="h-3 w-3 text-primary" />
                <span className="font-medium">{s.title}</span>
                <span className="text-muted-foreground">· {s.titleZh}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Minimal markdown renderer for **bold**, lists, and line breaks
function renderMarkdownLite(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={key++} className="list-disc pl-5 space-y-1">
          {listBuf.map((li, i) => (
            <li key={i}>{renderInline(li)}</li>
          ))}
        </ul>
      );
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      flushList();
      out.push(
        <div key={key++} className="pl-1">
          {renderInline(line)}
        </div>
      );
    } else if (line === "") {
      flushList();
      out.push(<div key={key++} className="h-1" />);
    } else {
      flushList();
      out.push(
        <p key={key++} className="m-0">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return <>{out}</>;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
