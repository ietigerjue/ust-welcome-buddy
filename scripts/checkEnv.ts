import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type EnvCheck = {
  name: string;
  group: string;
  required: boolean;
  secret: boolean;
  purpose: string;
};

const envChecks: EnvCheck[] = [
  { name: "RAG_DEBUG", group: "App", required: false, secret: false, purpose: "Optional server-side retrieval debug logs." },
  { name: "ADMIN_IMPORT_TOKEN", group: "Admin", required: true, secret: true, purpose: "Admin API and page protection." },
  { name: "SUPABASE_URL", group: "Supabase", required: true, secret: false, purpose: "Supabase project URL." },
  { name: "SUPABASE_SERVICE_ROLE_KEY", group: "Supabase", required: true, secret: true, purpose: "Server-side Supabase privileged key." },
  { name: "MODEL_SECRET_ENCRYPTION_KEY", group: "Supabase", required: false, secret: true, purpose: "Encrypts backend-stored model API keys and direct base URLs." },
  { name: "LLM_PROVIDER", group: "Chat LLM", required: false, secret: false, purpose: "Optional chat provider fallback." },
  { name: "MINIMAX_API_KEY", group: "Chat LLM", required: false, secret: true, purpose: "MiniMax text LLM API key." },
  { name: "MINIMAX_BASE_URL", group: "Chat LLM", required: false, secret: false, purpose: "MiniMax text LLM base URL." },
  { name: "MINIMAX_MODEL", group: "Chat LLM", required: false, secret: false, purpose: "MiniMax text LLM model name." },
  { name: "DEEPSEEK_API_KEY", group: "Chat LLM", required: false, secret: true, purpose: "Optional DeepSeek API key." },
  { name: "DEEPSEEK_BASE_URL", group: "Chat LLM", required: false, secret: false, purpose: "Optional DeepSeek API base URL." },
  { name: "DEEPSEEK_MODEL", group: "Chat LLM", required: false, secret: false, purpose: "Optional DeepSeek model name." },
  { name: "METADATA_LLM_PROVIDER", group: "Metadata LLM", required: false, secret: false, purpose: "Optional metadata provider fallback." },
  { name: "IMAGE_PARSE_PROVIDER", group: "Image Parser / VLM", required: false, secret: false, purpose: "Image parser provider selector." },
  { name: "MINIMAX_VLM_API_KEY", group: "Image Parser / VLM", required: false, secret: true, purpose: "MiniMax VLM API key for image import." },
  { name: "MINIMAX_VLM_BASE_URL", group: "Image Parser / VLM", required: false, secret: false, purpose: "MiniMax VLM base URL." },
  { name: "MINIMAX_VLM_ENDPOINT", group: "Image Parser / VLM", required: false, secret: false, purpose: "MiniMax VLM endpoint path." },
  { name: "EMBEDDING_PROVIDER", group: "Embedding", required: true, secret: false, purpose: "Embedding provider selector." },
  { name: "EMBEDDING_API_KEY", group: "Embedding", required: true, secret: true, purpose: "Embedding API key." },
  { name: "EMBEDDING_BASE_URL", group: "Embedding", required: true, secret: false, purpose: "Embedding API base URL." },
  { name: "EMBEDDING_MODEL", group: "Embedding", required: true, secret: false, purpose: "Embedding model name." },
  { name: "EMBEDDING_DIMENSIONS", group: "Embedding", required: true, secret: false, purpose: "Embedding vector dimensions." },
  { name: "SEMANTIC_DUPLICATE_THRESHOLD", group: "Embedding", required: false, secret: false, purpose: "Optional semantic duplicate review similarity threshold." },
  { name: "HTTPS_PROXY", group: "Proxy / Network", required: false, secret: true, purpose: "Optional outbound proxy." },
  { name: "HTTP_PROXY", group: "Proxy / Network", required: false, secret: true, purpose: "Optional outbound proxy." },
  { name: "OPENAI_API_KEY", group: "Optional Future Providers", required: false, secret: true, purpose: "Reserved future provider key." },
  { name: "DEEPSEEK_API_KEY", group: "Optional Future Providers", required: false, secret: true, purpose: "Reserved future provider key." },
];

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const grouped = new Map<string, EnvCheck[]>();
for (const check of envChecks) {
  const group = grouped.get(check.group) ?? [];
  group.push(check);
  grouped.set(check.group, group);
}

const missingRequired: string[] = [];

console.log("[check:env] UST Buddy environment check");
console.log("[check:env] Values are not printed. Only true/false status is shown.");

for (const [group, checks] of grouped.entries()) {
  console.log(`\n[${group}]`);
  for (const check of checks) {
    const exists = Boolean(process.env[check.name]);
    const requiredLabel = check.required ? "required" : "optional";
    const secretLabel = check.secret ? "secret" : "non-secret";
    console.log(`- ${check.name}: ${exists} (${requiredLabel}, ${secretLabel})`);
    if (check.required && !exists) {
      missingRequired.push(check.name);
    }
  }
}

if (missingRequired.length > 0) {
  console.error(`\n[check:env] Missing required variables: ${missingRequired.join(", ")}`);
  process.exit(1);
}

const configuredChatKeyEnv =
  process.env.CHAT_LLM_API_KEY_ENV || process.env.METADATA_LLM_API_KEY_ENV;
const configuredChatBaseUrlEnv =
  process.env.CHAT_LLM_BASE_URL_ENV || process.env.METADATA_LLM_BASE_URL_ENV;
const hasTextLlmKey = Boolean(
  process.env.MINIMAX_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    (configuredChatKeyEnv && process.env[configuredChatKeyEnv])
);
const hasTextLlmBaseUrl = Boolean(
  process.env.MINIMAX_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    (configuredChatBaseUrlEnv && process.env[configuredChatBaseUrlEnv])
);
const hasTextLlmModel = Boolean(
  process.env.MINIMAX_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    process.env.CHAT_LLM_MODEL ||
    process.env.METADATA_LLM_MODEL
);

if (!hasTextLlmKey || !hasTextLlmBaseUrl || !hasTextLlmModel) {
  console.error(
    "\n[check:env] Missing text LLM runtime config. Configure MiniMax, DeepSeek, or CHAT_LLM_* env-var-name mappings."
  );
  process.exit(1);
}

console.log("\n[check:env] Required environment variables are present.");
