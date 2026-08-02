import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "./supabaseServer";
import type { ModelConfigKey } from "./appConfig";

export type ModelSecretField = "api_key" | "base_url";

type ModelSecretRow = {
  key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
};

type ModelSecretStatus = {
  apiKeyConfigured: boolean;
  baseUrlConfigured: boolean;
};

const ENCRYPTION_KEY_ENV = "MODEL_SECRET_ENCRYPTION_KEY";
const CIPHER_ALGORITHM = "aes-256-gcm";

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function getSecretStorageKey(configKey: ModelConfigKey, field: ModelSecretField) {
  return `${configKey}.${field}`;
}

function decodeKey(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const hex = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : null;

  if (hex?.length === 32) {
    return hex;
  }

  try {
    const base64 = Buffer.from(trimmed, "base64");

    if (base64.length === 32) {
      return base64;
    }
  } catch {
    // Fall through to hash-based derivation for operational compatibility.
  }

  return createHash("sha256").update(trimmed).digest();
}

function getEncryptionKey() {
  const configured = getEnv(ENCRYPTION_KEY_ENV);
  const key = decodeKey(configured);

  if (!key) {
    return null;
  }

  return key;
}

export function isSecureModelSecretStorageConfigured() {
  return Boolean(getEncryptionKey() && getSupabaseServerClient());
}

function encryptSecret(value: string) {
  const key = getEncryptionKey();

  if (!key) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} is required before saving model provider secrets.`
    );
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted_value: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: authTag.toString("base64"),
  };
}

function decryptSecret(row: ModelSecretRow) {
  const key = getEncryptionKey();

  if (!key) {
    return undefined;
  }

  const decipher = createDecipheriv(
    CIPHER_ALGORITHM,
    key,
    Buffer.from(row.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_value, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function upsertModelSecret({
  configKey,
  field,
  value,
}: {
  configKey: ModelConfigKey;
  field: ModelSecretField;
  value: string;
}) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return;
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase server client is not configured.");
  }

  const encrypted = encryptSecret(trimmedValue);
  const { error } = await supabase.from("model_secrets").upsert(
    {
      key: getSecretStorageKey(configKey, field),
      ...encrypted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getModelSecret(
  configKey: ModelConfigKey,
  field: ModelSecretField
) {
  const supabase = getSupabaseServerClient();

  if (!supabase || !getEncryptionKey()) {
    return undefined;
  }

  try {
    const { data, error } = await supabase
      .from("model_secrets")
      .select("key, encrypted_value, iv, auth_tag")
      .eq("key", getSecretStorageKey(configKey, field))
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.warn("[model_secrets] secret read unavailable", {
          field,
          configKey,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      }

      return undefined;
    }

    return decryptSecret(data as ModelSecretRow);
  } catch (error) {
    console.warn("[model_secrets] failed to decrypt model secret", {
      field,
      configKey,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export async function getModelSecretStatus(
  configKey: ModelConfigKey
): Promise<ModelSecretStatus> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return {
      apiKeyConfigured: false,
      baseUrlConfigured: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from("model_secrets")
      .select("key")
      .in("key", [
        getSecretStorageKey(configKey, "api_key"),
        getSecretStorageKey(configKey, "base_url"),
      ]);

    if (error) {
      console.warn("[model_secrets] secret status unavailable", {
        configKey,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return {
        apiKeyConfigured: false,
        baseUrlConfigured: false,
      };
    }

    const keys = new Set((data ?? []).map((row) => row.key));

    return {
      apiKeyConfigured: keys.has(getSecretStorageKey(configKey, "api_key")),
      baseUrlConfigured: keys.has(getSecretStorageKey(configKey, "base_url")),
    };
  } catch (error) {
    console.warn("[model_secrets] failed to read secret status", {
      configKey,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      apiKeyConfigured: false,
      baseUrlConfigured: false,
    };
  }
}
