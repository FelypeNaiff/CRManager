export const TENANT_RESOURCE_NOT_FOUND = 'Recurso não encontrado.';

export function tenantWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}

export function tenantChildWhere(id: string, companyId: string) {
  return { id, customer: { companyId } } as const;
}

export function tenantTagRelationWhere(customerId: string, tagId: string, companyId: string) {
  return {
    customerId,
    tagId,
    customer: { companyId },
    tag: { companyId },
  } as const;
}

export function authenticatedActor<T extends { companyId: string; userId: string }>(
  auth: T,
  _untrusted?: { companyId?: string; userId?: string },
) {
  return { companyId: auth.companyId, userId: auth.userId } as const;
}
