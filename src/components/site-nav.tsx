import { Link, useRouterState } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home", zh: "首頁" },
  { to: "/chat", label: "Chat", zh: "對話" },
  { to: "/knowledge", label: "Knowledge Base", zh: "知識庫" },
  { to: "/upload", label: "Upload", zh: "上載" },
  { to: "/documents", label: "Documents", zh: "文件" },
];

export function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">UST Buddy</span>
            <span className="text-[10px] text-muted-foreground">科大新生小助手</span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-colors",
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {l.label}
                <span className="ml-1.5 text-[10px] text-muted-foreground/70">{l.zh}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          to="/chat"
          className="hidden sm:inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Ask UST Buddy
        </Link>
      </div>
      <nav className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2 border-t border-border/40">
        {links.map((l) => {
          const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "shrink-0 px-3 py-1.5 text-xs rounded-md",
                active ? "bg-secondary font-medium" : "text-muted-foreground"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-16">
      <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© 2026 UST Buddy · Built for HKUST freshmen · 科大新生小助手</p>
        <p>Prototype · Mock data only</p>
      </div>
    </footer>
  );
}
