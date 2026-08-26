export type ReceivablesAuthScope = Readonly<{
  companyId: string;
  userId: string;
  isAdmin?: boolean;
}>;

export function receivableTenantWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}

export function scopeReceivablesList<T extends Record<string, unknown>>(
  auth: ReceivablesAuthScope,
  filters?: T,
  _externalCompanyId?: string,
) {
  return { ...(filters ?? {}), companyId: auth.companyId };
}

export function secureReceivableSettlement(
  auth: ReceivablesAuthScope,
  receivableId: string,
  _untrusted?: { companyId?: string; userId?: string },
) {
  return {
    receivableId,
    companyId: auth.companyId,
    userId: auth.userId,
  } as const;
}

export function relatedTenantWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}
