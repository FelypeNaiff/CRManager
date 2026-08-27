export const SELLER_PERMISSIONS = {
  view: { module: 'USUARIOS', action: 'VIEW' },
  create: { module: 'USUARIOS', action: 'CREATE' },
  update: { module: 'USUARIOS', action: 'UPDATE' },
  disable: { module: 'USUARIOS', action: 'DISABLE' },
} as const;

export function sellerTenantWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}
