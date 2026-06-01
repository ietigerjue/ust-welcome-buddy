import { createFileRoute } from "@tanstack/react-router";
import {
  getConfigEnvStatus,
  getAppConfig,
  MODEL_CONFIG_KEYS,
  type AppConfig,
  type ModelConfigKey,
  type ModelProviderConfig,
} from "@/lib/appConfig";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ConfigValue = {
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

type ConfigResponse =
  | (Record<ModelConfigKey, ConfigValue> & {
      warnings?: string[];
    })
  | {
      error: string;
      warnings?: string[];
    };

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

const ALLOWED_CONFIG_FIELDS = new Set([
  "provider",
  "model",
  "base_url_env",
  "api_key_env",
  "endpoint_env",
  "dimensions",
  "fallback_provider",
  "enabled",
]);
const READONLY_STATUS_FIELDS = new Set([
  "baseUrlConfigured",
  "keyConfigured",
]);
const FORBIDDEN_SECRET_FIELDS = new Set([
  "api_key",
  "apikey",
  "apiKey",
  "key",
  "secret",
  "token",
  "password",
  "service_role_key",
  "serviceRoleKey",
]);
const ENV_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SECRET_VALUE_PATTERN =
  /^(sk-|sk_|eyJ|AIza|xox[baprs]-|gh[pousr]_|glpat-|pat_)/i;

function json(data: ConfigResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAuthorized(request: Request) {
  const expectedToken = getEnv("ADMIN_IMPORT_TOKEN");
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasForbiddenSecretField(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      FORBIDDEN_SECRET_FIELDS.has(key) ||
      (key.toLowerCase().includes("secret") && key !== "fallback_provider") ||
      (key.toLowerCase().includes("token") && key !== "endpoint_env") ||
      (key.toLowerCase().includes("password"))
    ) {
      return key;
    }

    const nestedMatch = hasForbiddenSecretField(nestedValue);

    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function getString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function getOptionalString(value: unknown) {
  const text = getString(value);

  return text || undefined;
}

function getOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getPositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);

    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function isValidEnvVarName(value: string) {
  return ENV_VAR_NAME_PATTERN.test(value);
}

function looksLikeSecretValue(value: string) {
  return SECRET_VALUE_PATTERN.test(value.trim());
}

function sanitizeConfigValue(value: unknown): ConfigValue {
  if (!isRecord(value)) {
    return {
      provider: "",
      model: "",
      base_url_env: "",
      api_key_env: "",
    };
  }

  const sanitized: ConfigValue = {
    provider: getString(value.provider),
    model: getString(value.model),
    base_url_env: getString(value.base_url_env),
    api_key_env: getString(value.api_key_env),
  };
  const endpointEnv = getOptionalString(value.endpoint_env);
  const dimensions = getPositiveInteger(value.dimensions);
  const fallbackProvider = getOptionalString(value.fallback_provider);
  const enabled = getOptionalBoolean(value.enabled);

  if (endpointEnv) {
    sanitized.endpoint_env = endpointEnv;
  }

  if (dimensions) {
    sanitized.dimensions = dimensions;
  }

  if (fallbackProvider) {
    sanitized.fallback_provider = fallbackProvider;
  }

  if (typeof enabled === "boolean") {
    sanitized.enabled = enabled;
  }

  return sanitized;
}

function validateConfig(config: Partial<Record<ModelConfigKey, ConfigValue>>) {
  const errors: string[] = [];

  if (!config.chat_llm?.provider) {
    errors.push("chat_llm.provider is required.");
  }

  if (!config.chat_llm?.model) {
    errors.push("chat_llm.model is required.");
  }

  if (!config.metadata_llm?.provider) {
    errors.push("metadata_llm.provider is required.");
  }

  if (!config.image_parser?.provider) {
    errors.push("image_parser.provider is required.");
  }

  if (!config.embedding?.provider) {
    errors.push("embedding.provider is required.");
  }

  if (!config.embedding?.model) {
    errors.push("embedding.model is required.");
  }

  if (!config.embedding?.dimensions) {
    errors.push("embedding.dimensions must be a positive integer.");
  }

  for (const key of MODEL_CONFIG_KEYS) {
    const item = config[key];

    if (!item) {
      continue;
    }

    for (const field of ["base_url_env", "api_key_env", "endpoint_env"] as const) {
      const value = item[field];

      if (!value) {
        if (field === "base_url_env" || field === "api_key_env") {
          errors.push(`${key}.${field} is required.`);
        }

        continue;
      }

      if (!isValidEnvVarName(value) || looksLikeSecretValue(value)) {
        errors.push(
          `${key}.${field} must be an environment variable name, not a secret or raw value.`
        );
      }
    }
  }

  return errors;
}

function stripRuntimeFields(config: AppConfig): Record<ModelConfigKey, ConfigValue> {
  return Object.fromEntries(
    MODEL_CONFIG_KEYS.map((key) => {
      const value = config[key];
      const envStatus = getConfigEnvStatus(value);

      return [
        key,
        {
          provider: value.provider,
          model: value.model,
          base_url_env: value.base_url_env,
          api_key_env: value.api_key_env,
          endpoint_env: value.endpoint_env,
          dimensions: value.dimensions,
          fallback_provider: value.fallback_provider,
          enabled: value.enabled,
          baseUrlConfigured: envStatus.baseUrlEnvExists,
          keyConfigured: envStatus.apiKeyEnvExists,
        },
      ];
    })
  ) as Record<ModelConfigKey, ConfigValue>;
}

function hasUnexpectedFields(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return Object.keys(value).find(
    (field) =>
      !ALLOWED_CONFIG_FIELDS.has(field) && !READONLY_STATUS_FIELDS.has(field)
  );
}

export const Route = createFileRoute("/api/admin/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const config = await getAppConfig();

        return json(stripRuntimeFields(config));
      },

      PUT: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const supabase = getSupabaseServerClient();

        if (!supabase) {
          return json(
            { error: "Supabase server client is not configured." },
            { status: 500 }
          );
        }

        const body = await request.json().catch(() => null);

        if (!isRecord(body)) {
          return json({ error: "Request body must be a JSON object." }, { status: 400 });
        }

        const forbiddenField = hasForbiddenSecretField(body);

        if (forbiddenField) {
          return json(
            {
              error: `Forbidden secret-like field "${forbiddenField}" detected. Store real API keys only in environment variables, not app_config.`,
            },
            { status: 400 }
          );
        }

        for (const key of MODEL_CONFIG_KEYS) {
          const unexpectedField = hasUnexpectedFields(body[key]);

          if (unexpectedField) {
            return json(
              {
                error: `Unsupported field "${unexpectedField}" in ${key}.`,
              },
              { status: 400 }
            );
          }
        }

        const currentConfig = await getAppConfig();
        const sanitized = Object.fromEntries(
          MODEL_CONFIG_KEYS.map((key) => [
            key,
            sanitizeConfigValue(body[key] ?? currentConfig[key]),
          ])
        ) as Record<ModelConfigKey, ConfigValue>;
        const errors = validateConfig(sanitized);

        if (errors.length > 0) {
          return json({ error: errors.join(" ") }, { status: 400 });
        }

        const warnings: string[] = [];
        const currentDimensions = currentConfig.embedding.dimensions;
        const nextDimensions = sanitized.embedding.dimensions;

        if (
          currentDimensions &&
          nextDimensions &&
          currentDimensions !== nextDimensions
        ) {
          warnings.push(
            "Changing embedding dimensions requires rebuilding document_chunks.embedding and pgvector RPC."
          );
        }

        const rows = MODEL_CONFIG_KEYS.map((key) => ({
          key,
          value: sanitized[key],
        }));
        const { error } = await supabase
          .from("app_config")
          .upsert(rows, { onConflict: "key" });

        if (error) {
          return json({ error: error.message }, { status: 500 });
        }

        const savedConfig = await getAppConfig();

        return json({
          ...stripRuntimeFields(savedConfig),
          warnings,
        });
      },
    },
  },
});
