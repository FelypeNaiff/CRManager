export type AuditChanges = Record<string, { before?: unknown; after?: unknown; changed?: true }>;

export function addAuditChange(
  changes: AuditChanges,
  field: string,
  before: unknown,
  after: unknown,
  options: { sensitive?: boolean } = {},
) {
  const normalizedBefore = before ?? null;
  const normalizedAfter = after ?? null;
  if (String(normalizedBefore) === String(normalizedAfter)) return;
  changes[field] = options.sensitive
    ? { changed: true }
    : { before: normalizedBefore, after: normalizedAfter };
}

export function permissionDelta(
  before: Array<{ module: string; action: string; allowed: boolean }>,
  after: Array<{ module: string; action: string; allowed: boolean }>,
) {
  const keys = (items: typeof before) => new Set(
    items.filter(item => item.allowed).map(item => `${item.module}:${item.action}`),
  );
  const previous = keys(before);
  const next = keys(after);
  return {
    added: [...next].filter(key => !previous.has(key)).sort(),
    removed: [...previous].filter(key => !next.has(key)).sort(),
  };
}
