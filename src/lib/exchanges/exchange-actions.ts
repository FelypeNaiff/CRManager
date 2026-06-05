'use server';
import { serializePrisma } from '@/lib/serialize';

import { requirePermission } from "@/lib/auth/permissions";
import { exchangeService, CreateExchangeInput } from "./exchange-service";

export async function createExchangeAction(data: Omit<CreateExchangeInput, "userId">) {
  const session = await requirePermission("TROCAS", "CREATE");
  try {
    const exchange = await exchangeService.createExchange({
      ...data,
      userId: session.userId
    });
    if (exchange && 'requireAuthorization' in exchange) {
      return { success: false, requireAuthorization: true, authorizationId: exchange.authorizationId };
    }
    return { success: true, exchange };
  } catch (error: any) {
    console.error("Error in createExchangeAction:", error);
    return { success: false, error: error.message || "Erro ao processar troca." };
  }
}

export async function getExchangeAction(id: string) {
  await requirePermission("TROCAS", "VIEW");
  try {
    const exchange = await exchangeService.getExchange(id);
    return { success: true, exchange };
  } catch (error: any) {
    console.error("Error in getExchangeAction:", error);
    return { success: false, error: error.message || "Erro ao obter troca." };
  }
}

export async function cancelExchangeAction(id: string) {
  const session = await requirePermission("TROCAS", "DELETE");
  try {
    const exchange = await exchangeService.cancelExchange(id, session.userId);
    return { success: true, exchange };
  } catch (error: any) {
    console.error("Error in cancelExchangeAction:", error);
    return { success: false, error: error.message || "Erro ao cancelar troca." };
  }
}
