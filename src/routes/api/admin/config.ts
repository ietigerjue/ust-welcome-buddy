import { createFileRoute } from "@tanstack/react-router";
import {
  getAppConfig,
  getConfigEnvStatus,
  MODEL_CONFIG_KEYS,
  type AppConfig,
  type ModelConfigKey,
} from "@/lib/appConfig";

type ConfigValue = {
  provider: string;
  model: string;
  base_url_env: string;
  api_key_env: string;
  endpoint_env?: string;
  dimensions?: number;
  fallback_provider?: string;
  enabled?: boolean;
  baseUrlConfigured: boolean;
  keyConfigured: boolean;
};

type ConfigResponse =
  | (Record<ModelConfigKey, ConfigValue> & {
      managedBy: "environment";
      warnings: string[];
    })
  | {
      error: string;
    };

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

const ENV_MANAGED_MESSAGE =
  "Model configuration is managed by server environment variables. Update .env.local for local development or Vercel Environment Variables for deployment, then restart or redeploy.";

function json(data: ConfigResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike }).process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAuthorized(request: Request) {
  const expectedToken = getEnv("ADMIN_IMPORT_TOKEN");
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
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
    }),
  ) as Record<ModelConfigKey, ConfigValue>;
}

export const Route = createFileRoute("/api/admin/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const config = await getAppConfig();

        return json({
          ...stripRuntimeFields(config),
          managedBy: "environment",
          warnings: [ENV_MANAGED_MESSAGE],
        });
      },

      PUT: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        return json({ error: ENV_MANAGED_MESSAGE }, { status: 409 });
      },
    },
  },
});
