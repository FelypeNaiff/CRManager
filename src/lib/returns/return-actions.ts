'use server';
import { serializePrisma } from '@/lib/serialize';

import { requirePermission } from "@/lib/auth/permissions";
import { returnService, CreateReturnInput } from "./return-service";
import { scopeTenantOperationInput } from "../exchanges/exchange-return-tenant-security";

export async function createReturnAction(data: Omit<CreateReturnInput, "userId">) {
  const auth = await requirePermission("DEVOLUCOES", "CREATE");
  try {
    const saleReturn = await returnService.createReturn(scopeTenantOperationInput(
      { ...data, userId: auth.userId }, auth
    ), auth);
    if (saleReturn && 'requireAuthorization' in saleReturn) {
      return { success: false, requireAuthorization: true, authorizationId: (saleReturn as any).authorizationId };
    }
    return { success: true, returnRecord: saleReturn };
  } catch {
    return { success: false, error: "Não foi possível processar a devolução." };
  }
}

export async function getReturnAction(id: string) {
  const auth = await requirePermission("DEVOLUCOES", "VIEW");
  try {
    const returnRecord = await returnService.getReturn(id, auth.companyId);
    return { success: true, returnRecord };
  } catch {
    return { success: false, error: "Devolução não encontrada." };
  }
}

export async function cancelReturnAction(id: string) {
  const auth = await requirePermission("DEVOLUCOES", "CANCEL");
  try {
    const returnRecord = await returnService.cancelReturn(id, auth.companyId, auth.userId, auth);
    return { success: true, returnRecord };
  } catch {
    return { success: false, error: "Não foi possível cancelar a devolução." };
  }
}
