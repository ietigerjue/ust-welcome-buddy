import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import {
  Plane,
  Home,
  Bus,
  Utensils,
  Smartphone,
  CreditCard,
  ArrowRight,
  Sparkles,
  MessageSquareText,
  BookOpen,
  Languages,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "UST Buddy — AI guide for HKUST freshmen" },
      {
        name: "description",
        content:
          "UST Buddy is an AI chatbot for new HKUST students. Ask about housing, transport, SIM cards, food, banking and arrival prep — in English and Chinese.",
      },
      { property: "og:title", content: "UST Buddy — AI guide for HKUST freshmen" },
      {
        property: "og:description",
        content:
          "Ask anything about settling into HKUST. Bilingual EN + 中文, with sourced answers.",
      },
    ],
  }),
});

const topics = [
  { icon: Plane, label: "Arrival", zh: "抵港" },
  { icon: Home, label: "Housing", zh: "宿舍" },
  { icon: Bus, label: "Transport", zh: "交通" },
  { icon: Utensils, label: "Food", zh: "餐飲" },
  { icon: Smartphone, label: "SIM Card", zh: "電話卡" },
  { icon: CreditCard, label: "Banking", zh: "銀行" },
];

const examples = [
  "How do I get to HKUST from Hong Kong Airport?",
  "What should I prepare before moving into the dorm?",
  "Where can I get a SIM card in Hong Kong?",
  "How do I use Octopus card?",
  "What food options are available on campus?",
];

function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/40 via-background to-background pointer-events-none" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[420px] w-[700px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-primary" />
              AI campus assistant · Built for HKUST · 為科大新生而設
            </div>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground">
              Your AI buddy for life at HKUST
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              科大新生 AI 小助手 · 一站式回答你所有的問題
            </p>
            <p className="mt-6 mx-auto max-w-2xl text-base text-muted-foreground leading-relaxed">
              From the airport to your dorm room, from your first Octopus tap to your
              registration paperwork — UST Buddy answers freshmen questions instantly,
              with sources you can trust.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Start chatting
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Learn more
              </Link>
            </div>

            {/* Topic pills */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-2">
              {topics.map((t) => (
                <div
                  key={t.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground"
                >
                  <t.icon className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">{t.label}</span>
                  <span className="text-[10px]">{t.zh}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Examples */}
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Ask anything a freshman would ask
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">常見問題範例 · Click to try</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {examples.map((q) => (
              <Link
                key={q}
                to="/chat"
                search={{ q }}
                className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <span className="text-sm text-foreground/90">{q}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: MessageSquareText,
                title: "Conversational",
                zh: "對話式回答",
                desc: "Ask naturally, like talking to a senior student.",
              },
              {
                icon: BookOpen,
                title: "Sourced answers",
                zh: "註明資料來源",
                desc: "Every reply cites the HKUST guide it came from.",
              },
              {
                icon: Languages,
                title: "Bilingual",
                zh: "中英雙語",
                desc: "Comfortable in English and Chinese.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary mb-3">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <span className="text-[10px] text-muted-foreground">{f.zh}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
