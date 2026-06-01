import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { SiteNav } from "@/components/site-nav";

type ConfigKey = "chat_llm" | "metadata_llm" | "image_parser" | "embedding";
type LoadStatus = "idle" | "loading" | "success" | "error";
type SaveStatus = "idle" | "saving" | "success" | "error";

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
  error?: string;
  warnings?: string[];
};

const CONFIG_SECTIONS: Array<{
  key: ConfigKey;
  title: string;
  description: string;
  showDimensions?: boolean;
  requireModel?: boolean;
}> = [
  {
    key: "chat_llm",
    title: "Chat LLM",
    description: "User-facing answer generation for /api/chat.",
    requireModel: true,
  },
  {
    key: "metadata_llm",
    title: "Metadata LLM",
    description: "Metadata extraction for Markdown, WeChat paste, and OCR text.",
  },
  {
    key: "image_parser",
    title: "Image Parser",
    description: "Image / long screenshot understanding provider configuration.",
  },
  {
    key: "embedding",
    title: "Embedding",
    description: "Embedding provider for pgvector semantic retrieval.",
    showDimensions: true,
    requireModel: true,
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
};

function createEmptyForm(): ConfigForm {
  return {
    chat_llm: { ...EMPTY_CONFIG },
    metadata_llm: { ...EMPTY_CONFIG },
    image_parser: { ...EMPTY_CONFIG },
    embedding: { ...EMPTY_CONFIG },
  };
}

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
  head: () => ({
    meta: [{ title: "Admin Settings — UST Buddy" }],
  }),
});

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

function toPayload(form: ConfigForm) {
  return Object.fromEntries(
    CONFIG_SECTIONS.map(({ key, showDimensions }) => {
      const item = form[key];
      const payload: ConfigItem = {
        provider: item.provider.trim(),
        model: item.model.trim(),
        base_url_env: item.base_url_env.trim(),
        api_key_env: item.api_key_env.trim(),
        endpoint_env: item.endpoint_env?.trim() || undefined,
        fallback_provider: item.fallback_provider?.trim() || undefined,
        enabled: item.enabled ?? true,
      };

      if (showDimensions && item.dimensions) {
        payload.dimensions = item.dimensions;
      }

      return [key, payload];
    })
  );
}

function AdminSettingsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [form, setForm] = useState<ConfigForm>(() => createEmptyForm());
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  async function loadConfig() {
    setLoadStatus("loading");
    setSaveStatus("idle");
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

      setForm(normalizeConfigResponse(data));
      setWarnings(data.warnings ?? []);
      setLoadStatus("success");
      setMessage("Config loaded.");
    } catch (error) {
      setLoadStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to load config."
      );
    }
  }

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveStatus("saving");
    setMessage("");
    setWarnings([]);

    try {
      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify(toPayload(form)),
      });
      const data = (await response.json().catch(() => ({}))) as ConfigResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to save config.");
      }

      setForm(normalizeConfigResponse(data));
      setWarnings(data.warnings ?? []);
      setSaveStatus("success");
      setLoadStatus("success");
      setMessage("Config saved and reloaded.");
    } catch (error) {
      setSaveStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to save config."
      );
    }
  }

  function updateConfig(key: ConfigKey, patch: Partial<ConfigItem>) {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <AdminNav />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground mb-4">
              <Settings className="h-3.5 w-3.5 text-primary" />
              Admin settings · 模型配置
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              模型配置
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              管理 app_config 中的 provider、model 和环境变量名。此页面不保存、不显示真实 API Key。
            </p>
          </div>
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
              Security note
            </div>
            <p className="mt-1">
              API keys are stored only in environment variables. This page only
              stores provider/model/env variable names. If keyConfigured is
              false, configure the named key in .env.local or Vercel Environment
              Variables.
            </p>
          </div>

          <StatusLine
            loadStatus={loadStatus}
            saveStatus={saveStatus}
            message={message}
          />
          <Warnings warnings={warnings} />
        </section>

        <form onSubmit={saveConfig} className="mt-6 grid gap-4">
          {CONFIG_SECTIONS.map((section) => (
            <ConfigSection
              key={section.key}
              title={section.title}
              description={section.description}
              value={form[section.key]}
              showDimensions={section.showDimensions}
              requireModel={section.requireModel}
              onChange={(patch) => updateConfig(section.key, patch)}
            />
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              保存后配置会写入 Supabase app_config。真实密钥仍需在 .env.local 或 Vercel Environment Variables 配置。
            </p>
            <button
              type="submit"
              disabled={saveStatus === "saving" || !adminToken.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Config
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function ConfigSection({
  title,
  description,
  value,
  showDimensions,
  requireModel,
  onChange,
}: {
  title: string;
  description: string;
  value: ConfigItem;
  showDimensions?: boolean;
  requireModel?: boolean;
  onChange: (patch: Partial<ConfigItem>) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={value.enabled ?? true}
            onChange={(event) => onChange({ enabled: event.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          enabled
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField label="provider" required>
          <input
            value={value.provider}
            onChange={(event) => onChange({ provider: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            required
          />
        </ConfigField>

        <ConfigField label="model" required={requireModel}>
          <input
            value={value.model}
            onChange={(event) => onChange({ model: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            required={requireModel}
          />
        </ConfigField>

        <ConfigField label="base_url_env">
          <input
            value={value.base_url_env}
            onChange={(event) => onChange({ base_url_env: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            placeholder="MINIMAX_BASE_URL"
          />
          <ConfigStatus
            label="baseUrlConfigured"
            configured={value.baseUrlConfigured}
            envName={value.base_url_env}
          />
        </ConfigField>

        <ConfigField label="api_key_env">
          <input
            value={value.api_key_env}
            onChange={(event) => onChange({ api_key_env: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            placeholder="MINIMAX_API_KEY"
          />
          <ConfigStatus
            label="keyConfigured"
            configured={value.keyConfigured}
            envName={value.api_key_env}
          />
        </ConfigField>

        <ConfigField label="endpoint_env">
          <input
            value={value.endpoint_env ?? ""}
            onChange={(event) => onChange({ endpoint_env: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            placeholder="MINIMAX_VLM_ENDPOINT"
          />
        </ConfigField>

        <ConfigField label="fallback_provider">
          <input
            value={value.fallback_provider ?? ""}
            onChange={(event) =>
              onChange({ fallback_provider: event.target.value })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            placeholder="ocr"
          />
        </ConfigField>

        {showDimensions ? (
          <ConfigField label="dimensions" required>
            <input
              value={value.dimensions ?? ""}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                onChange({
                  dimensions:
                    Number.isInteger(parsed) && parsed > 0 ? parsed : undefined,
                });
              }}
              type="number"
              min={1}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              required
            />
          </ConfigField>
        ) : null}
      </div>
    </section>
  );
}

function ConfigField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function ConfigStatus({
  label,
  configured,
  envName,
}: {
  label: string;
  configured?: boolean;
  envName: string;
}) {
  return (
    <span
      className={`text-[11px] ${
        configured ? "text-primary" : "text-destructive"
      }`}
    >
      {label}: {configured ? "true" : "false"}
      {envName ? ` · ${envName}` : ""}
      {!configured
        ? " · 请在 .env.local 或 Vercel Environment Variables 配置。"
        : ""}
    </span>
  );
}

function StatusLine({
  loadStatus,
  saveStatus,
  message,
}: {
  loadStatus: LoadStatus;
  saveStatus: SaveStatus;
  message: string;
}) {
  if (loadStatus === "idle" && saveStatus === "idle") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        状态：输入 Admin Token 后点击 Load Config
      </p>
    );
  }

  if (loadStatus === "loading" || saveStatus === "saving") {
    return (
      <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {loadStatus === "loading" ? "loading config..." : "saving config..."}
      </p>
    );
  }

  if (loadStatus === "error" || saveStatus === "error") {
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
