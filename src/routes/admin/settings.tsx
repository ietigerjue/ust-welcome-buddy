import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Settings, ShieldAlert, XCircle } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { SiteNav } from "@/components/site-nav";

type ConfigKey = "chat_llm" | "metadata_llm" | "image_parser" | "embedding";
type LoadStatus = "idle" | "loading" | "success" | "error";

type ConfigItem = {
  provider: string;
  model: string;
  base_url_env: string;
  api_key_env: string;
  endpoint_env?: string;
  dimensions?: number;
  fallback_provider?: string;
  enabled?: boolean;
  baseUrlConfigured?: boolean;
  keyConfigured?: boolean;
};

type ConfigForm = Record<ConfigKey, ConfigItem>;

type ConfigResponse = Partial<ConfigForm> & {
  managedBy?: "environment";
  error?: string;
  warnings?: string[];
};

const CONFIG_SECTIONS: Array<{
  key: ConfigKey;
  title: string;
  description: string;
  showDimensions?: boolean;
}> = [
  {
    key: "chat_llm",
    title: "Chat LLM",
    description: "User-facing answer generation for /api/chat.",
  },
  {
    key: "metadata_llm",
    title: "Metadata LLM",
    description: "Metadata extraction for admin ingestion flows.",
  },
  {
    key: "image_parser",
    title: "Image Parser",
    description: "Image and long screenshot understanding configuration.",
  },
  {
    key: "embedding",
    title: "Embedding",
    description: "Embedding provider for pgvector semantic retrieval.",
    showDimensions: true,
  },
];

const EMPTY_CONFIG: ConfigItem = {
  provider: "",
  model: "",
  base_url_env: "",
  api_key_env: "",
  endpoint_env: "",
  dimensions: undefined,
  fallback_provider: "",
  enabled: true,
  baseUrlConfigured: false,
  keyConfigured: false,
};

function createEmptyForm(): ConfigForm {
  return {
    chat_llm: { ...EMPTY_CONFIG },
    metadata_llm: { ...EMPTY_CONFIG },
    image_parser: { ...EMPTY_CONFIG },
    embedding: { ...EMPTY_CONFIG },
  };
}

function normalizeConfigItem(value: ConfigResponse[ConfigKey]): ConfigItem {
  return {
    provider: value?.provider ?? "",
    model: value?.model ?? "",
    base_url_env: value?.base_url_env ?? "",
    api_key_env: value?.api_key_env ?? "",
    endpoint_env: value?.endpoint_env ?? "",
    dimensions: value?.dimensions,
    fallback_provider: value?.fallback_provider ?? "",
    enabled: value?.enabled ?? true,
    baseUrlConfigured: value?.baseUrlConfigured ?? false,
    keyConfigured: value?.keyConfigured ?? false,
  };
}

function normalizeConfigResponse(data: ConfigResponse): ConfigForm {
  return {
    chat_llm: normalizeConfigItem(data.chat_llm),
    metadata_llm: normalizeConfigItem(data.metadata_llm),
    image_parser: normalizeConfigItem(data.image_parser),
    embedding: normalizeConfigItem(data.embedding),
  };
}

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
  head: () => ({
    meta: [{ title: "Admin Settings - UST Buddy" }],
  }),
});

function AdminSettingsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [config, setConfig] = useState<ConfigForm>(() => createEmptyForm());
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  async function loadConfig() {
    setLoadStatus("loading");
    setMessage("");
    setWarnings([]);

    try {
      const response = await fetch("/api/admin/config", {
        method: "GET",
        headers: {
          "x-admin-token": adminToken,
        },
      });
      const data = (await response.json().catch(() => ({}))) as ConfigResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load config.");
      }

      setConfig(normalizeConfigResponse(data));
      setWarnings(data.warnings ?? []);
      setLoadStatus("success");
      setMessage("Environment configuration loaded.");
    } catch (error) {
      setLoadStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to load config.");
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <AdminNav />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground mb-4">
            <Settings className="h-3.5 w-3.5 text-primary" />
            Admin settings · 环境配置
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">模型配置</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            当前运行时只读取服务端环境变量。此页面仅显示
            provider、model、变量名和配置状态，不保存或回显任何密钥。
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Admin Token <span className="text-destructive">*</span>
              </span>
              <input
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                type="password"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                placeholder="输入管理员 token"
              />
            </label>

            <button
              type="button"
              onClick={() => void loadConfig()}
              disabled={loadStatus === "loading" || !adminToken.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Load Config
            </button>
          </div>

          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="inline-flex items-center gap-2 font-medium text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-primary" />
              Environment-managed configuration
            </div>
            <p className="mt-1">
              本地请修改 .env.local 后重启开发服务器；线上请修改 Vercel Environment Variables
              后重新部署。Supabase app_config 和 model_secrets 不再覆盖运行时配置。
            </p>
          </div>

          <StatusLine status={loadStatus} message={message} />
          <Warnings warnings={warnings} />
        </section>

        <div className="mt-6 grid gap-4">
          {CONFIG_SECTIONS.map((section) => (
            <ConfigSection
              key={section.key}
              title={section.title}
              description={section.description}
              value={config[section.key]}
              showDimensions={section.showDimensions}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ConfigSection({
  title,
  description,
  value,
  showDimensions,
}: {
  title: string;
  description: string;
  value: ConfigItem;
  showDimensions?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {value.enabled === false ? "disabled" : "enabled"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="provider" value={value.provider} />
        <ReadOnlyField label="model" value={value.model} />
        <ReadOnlyField
          label="base_url_env"
          value={value.base_url_env}
          status={value.baseUrlConfigured}
        />
        <ReadOnlyField label="api_key_env" value={value.api_key_env} status={value.keyConfigured} />
        {value.endpoint_env ? (
          <ReadOnlyField label="endpoint_env" value={value.endpoint_env} />
        ) : null}
        {value.fallback_provider ? (
          <ReadOnlyField label="fallback_provider" value={value.fallback_provider} />
        ) : null}
        {showDimensions ? (
          <ReadOnlyField
            label="dimensions"
            value={value.dimensions ? String(value.dimensions) : ""}
          />
        ) : null}
      </div>
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        readOnly
        aria-readonly="true"
        className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground outline-none"
      />
      {typeof status === "boolean" ? (
        <span className={status ? "text-[11px] text-primary" : "text-[11px] text-destructive"}>
          configured: {status ? "true" : "false"}
        </span>
      ) : null}
    </label>
  );
}

function StatusLine({ status, message }: { status: LoadStatus; message: string }) {
  if (status === "idle") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        状态：输入 Admin Token 后点击 Load Config
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        loading config...
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="mt-4 inline-flex items-center gap-2 text-xs text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        error: {message || "Config operation failed."}
      </p>
    );
  }

  return (
    <p className="mt-4 inline-flex items-center gap-2 text-xs text-primary">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {message || "success"}
    </p>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}
