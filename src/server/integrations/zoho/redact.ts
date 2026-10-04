/** Remove secrets/tokens from payloads before writing sync_log. */

const SENSITIVE_KEYS =
  /^(authorization|access_token|refresh_token|client_secret|password|token|api[_-]?key|webhook[_-]?secret)$/i;

export function redactSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && looksLikeToken(value)) return "[REDACTED]";
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = redactValue(nested);
    }
  }
  return out;
}

function looksLikeToken(value: string) {
  return (
    value.length > 40 &&
    (/^1000\./.test(value) || /^zoho/i.test(value) || value.includes("."))
  );
}
