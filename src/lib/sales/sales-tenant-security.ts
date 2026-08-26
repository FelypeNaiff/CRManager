import type { ServerAuthContext } from '@/lib/auth/server-auth-context';
import type { CancelSaleInput, CreateSaleInput } from './sales-schemas';

export function scopeCreateSaleInput(
  input: CreateSaleInput,
  auth: Pick<ServerAuthContext, 'companyId'>
): CreateSaleInput {
  return { ...input, companyId: auth.companyId };
}

export function scopeCancelSaleInput(
  input: CancelSaleInput,
  auth: Pick<ServerAuthContext, 'userId'>
): CancelSaleInput {
  return { ...input, cancelledByUserId: auth.userId };
}

export function tenantResourceWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}

export function tenantListWhere(companyId: string) {
  return { companyId } as const;
}
