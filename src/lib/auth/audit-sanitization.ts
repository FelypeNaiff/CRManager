import { Prisma } from '@prisma/client';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(password|senha|token|access_?token|refresh_?token|pin|pinaccesshash|authorizationpinhash|secret|api_?key)/i;
const SENSITIVE_DETAIL = /\b(password|senha|access[_ -]?token|refresh[_ -]?token|token|pin(?:accesshash)?|authorizationpinhash|secret|api[_ -]?key)\b\s*[:=]?\s*[^,;\s]+/gi;

export type AuditMetadata = Record<string, unknown>;
type SanitizedJson = string | number | boolean | null | SanitizedJson[] | { [key: string]: SanitizedJson };

function sanitizeValue(value: unknown, seen: WeakSet<object>): SanitizedJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item, seen));
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  const sanitized: { [key: string]: SanitizedJson } = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(item, seen);
  }
  seen.delete(value);
  return sanitized;
}

export function sanitizeAuditMetadata(metadata?: AuditMetadata): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined;
  return sanitizeValue(metadata, new WeakSet()) as Prisma.InputJsonObject;
}

export function sanitizeAuditDetails(details?: string): string | undefined {
  return details?.replace(SENSITIVE_DETAIL, `$1=${REDACTED}`);
}
