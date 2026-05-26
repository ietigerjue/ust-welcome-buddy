import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { BookOpen, MessageSquareText, Languages, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — UST Buddy" },
      {
        name: "description",
        content:
          "UST Buddy is a friendly AI assistant for HKUST freshmen. Learn how it works, what it covers, and why answers always come with sources.",
      },
      { property: "og:title", content: "About — UST Buddy" },
      {
        property: "og:description",
        content: "Friendly AI campus assistant for new HKUST students.",
      },
    ],
  }),
});

const sources = [
  "HKUST Freshman Arrival Guide",
  "Dormitory Preparation Checklist",
  "Campus Transportation Guide",
  "Hong Kong Student Life Tips",
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground mb-5">
          <Sparkles className="h-3 w-3 text-primary" />
          About UST Buddy · 關於我們
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          A friendly AI guide for every new HKUST student.
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          搬到一個新城市、新校園，難免會有很多問題。UST Buddy 把所有新生資訊整理在一起，
          隨時用中英文為你解答。
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">What UST Buddy helps with</h2>
          <p className="text-sm text-muted-foreground">
            Arrival logistics from Hong Kong International Airport, dorm preparation,
            campus transport, dining options, getting a SIM card, opening a bank account,
            student ID and registration paperwork, and everyday Hong Kong life tips.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">How it works</h2>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {[
              {
                icon: MessageSquareText,
                title: "Ask",
                desc: "Type any freshman question in English or Chinese.",
              },
              {
                icon: BookOpen,
                title: "Answer",
                desc: "UST Buddy replies using a curated knowledge base.",
              },
              {
                icon: ShieldCheck,
                title: "Verify",
                desc: "Every answer shows its source documents.",
              },
            ].map((s) => (
              <div key={s.title} className="rounded-lg border border-border bg-card p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary mb-3">
                  <s.icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Knowledge sources</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The knowledge base is curated by the UST Buddy team — students don't upload
            anything. Current sources include:
          </p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2">
            {sources.map((s) => (
              <li
                key={s}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-secondary/40 p-5 flex items-center gap-3">
          <Languages className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm">
            <span className="font-medium">Bilingual by design.</span>{" "}
            <span className="text-muted-foreground">
              Ask in English or 中文 — UST Buddy understands both.
            </span>
          </p>
        </section>

        <section className="mt-10 rounded-xl border border-dashed border-border bg-card p-5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Prototype notice · 原型版本：</span>{" "}
          This is a frontend prototype. Answers are generated from mock data — no real AI
          model, database, or authentication is connected.
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try UST Buddy now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
