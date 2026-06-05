'use server';
import { serializePrisma } from '@/lib/serialize';

import { requirePermission } from "@/lib/auth/permissions";
import { returnService, CreateReturnInput } from "./return-service";

export async function createReturnAction(data: Omit<CreateReturnInput, "userId">) {
  const session = await requirePermission("DEVOLUCOES", "CREATE");
  try {
    const saleReturn = await returnService.createReturn({
      ...data,
      userId: session.userId
    });
    if (saleReturn && 'requireAuthorization' in saleReturn) {
      return { success: false, requireAuthorization: true, authorizationId: (saleReturn as any).authorizationId };
    }
    return { success: true, returnRecord: saleReturn };
  } catch (error: any) {
    console.error("Error in createReturnAction:", error);
    return { success: false, error: error.message || "Erro ao processar devolução." };
  }
}

export async function getReturnAction(id: string) {
  await requirePermission("DEVOLUCOES", "VIEW");
  try {
    const returnRecord = await returnService.getReturn(id);
    return { success: true, returnRecord };
  } catch (error: any) {
    console.error("Error in getReturnAction:", error);
    return { success: false, error: error.message || "Erro ao obter devolução." };
  }
}

export async function cancelReturnAction(id: string) {
  const session = await requirePermission("DEVOLUCOES", "DELETE");
  try {
    const returnRecord = await returnService.cancelReturn(id, session.userId);
    return { success: true, returnRecord };
  } catch (error: any) {
    console.error("Error in cancelReturnAction:", error);
    return { success: false, error: error.message || "Erro ao cancelar devolução." };
  }
}
