import type { ServerAuthContext } from '@/lib/auth/server-auth-context';

export function scopeTenantOperationInput<T extends { companyId: string; userId: string }>(
  input: T,
  auth: Pick<ServerAuthContext, 'companyId' | 'userId'>
): T {
  return { ...input, companyId: auth.companyId, userId: auth.userId };
}

export function tenantResourceWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}

export function itemBelongsToSale(
  saleItems: ReadonlyArray<{ variantId: string }>,
  variantId: string
): boolean {
  return saleItems.some(item => item.variantId === variantId);
}
