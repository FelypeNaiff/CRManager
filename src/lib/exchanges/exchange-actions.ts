'use server';
import { serializePrisma } from '@/lib/serialize';

import { requirePermission } from "@/lib/auth/permissions";
import { exchangeService, CreateExchangeInput } from "./exchange-service";
import { scopeTenantOperationInput } from "./exchange-return-tenant-security";

export async function createExchangeAction(data: Omit<CreateExchangeInput, "userId">) {
  const auth = await requirePermission("TROCAS", "CREATE");
  try {
    const exchange = await exchangeService.createExchange(scopeTenantOperationInput(
      { ...data, userId: auth.userId }, auth
    ), auth);
    if (exchange && 'requireAuthorization' in exchange) {
      return { success: false, requireAuthorization: true, authorizationId: exchange.authorizationId };
    }
    return { success: true, exchange };
  } catch {
    return { success: false, error: "Não foi possível processar a troca." };
  }
}

export async function getExchangeAction(id: string) {
  const auth = await requirePermission("TROCAS", "VIEW");
  try {
    const exchange = await exchangeService.getExchange(id, auth.companyId);
    return { success: true, exchange };
  } catch {
    return { success: false, error: "Troca não encontrada." };
  }
}

export async function cancelExchangeAction(id: string) {
  const auth = await requirePermission("TROCAS", "CANCEL");
  try {
    const exchange = await exchangeService.cancelExchange(id, auth.companyId, auth.userId, auth);
    return { success: true, exchange };
  } catch {
    return { success: false, error: "Não foi possível cancelar a troca." };
  }
}
