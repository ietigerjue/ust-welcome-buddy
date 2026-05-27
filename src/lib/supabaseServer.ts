import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

type SupabaseServerConfig = {
  url?: string;
  serviceRoleKey?: string;
};

let cachedClient: SupabaseClient | null = null;
let hasWarnedMissingConfig = false;

function getServerEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getSupabaseServerConfig(): SupabaseServerConfig {
  return {
    url: getServerEnv("SUPABASE_URL"),
    serviceRoleKey: getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getSupabaseServerClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getSupabaseServerConfig();
  const missingKeys = [
    ["SUPABASE_URL", config.url],
    ["SUPABASE_SERVICE_ROLE_KEY", config.serviceRoleKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    if (!hasWarnedMissingConfig) {
      console.warn(
        `[UST Buddy] Supabase question logging disabled. Missing env vars: ${missingKeys.join(
          ", "
        )}`
      );
      hasWarnedMissingConfig = true;
    }

    return null;
  }

  cachedClient = createClient(config.url ?? "", config.serviceRoleKey ?? "", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
