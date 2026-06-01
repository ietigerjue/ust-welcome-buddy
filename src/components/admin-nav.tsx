import { Link, useRouterState } from "@tanstack/react-router";
import { Database, FilePlus2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const adminLinks = [
  {
    to: "/admin/import",
    label: "Import",
    zh: "导入资料",
    icon: FilePlus2,
  },
  {
    to: "/admin/documents",
    label: "Documents",
    zh: "文档列表",
    icon: Database,
  },
  {
    to: "/admin/settings",
    label: "Settings",
    zh: "模型配置",
    icon: Settings,
  },
];

export function AdminNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="sticky top-16 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">
          Admin
        </span>
        {adminLinks.map(({ to, label, zh, icon: Icon }) => {
          const active = pathname === to;

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary/20 bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              <span
                className={cn(
                  "text-[10px] hidden sm:inline",
                  active
                    ? "text-primary-foreground/75"
                    : "text-muted-foreground/75"
                )}
              >
                {zh}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
