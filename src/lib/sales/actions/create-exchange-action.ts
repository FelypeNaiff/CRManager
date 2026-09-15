'use server';
import { serializePrisma } from '@/lib/serialize';

import { ExchangeService, ProcessExchangeReturnInput } from "../exchange-service";
import { requirePermission } from "@/lib/auth/permissions";
import { scopeTenantOperationInput } from "@/lib/exchanges/exchange-return-tenant-security";

export async function processExchangeReturnAction(data: ProcessExchangeReturnInput): Promise<{ success: true; exchangeReturn: any; totalCredit: number } | { success: false; error: string }> {
  try {
    const auth = await requirePermission("TROCAS", "CREATE");
    const exchangeService = new ExchangeService();
    const result = await exchangeService.processExchangeReturn(scopeTenantOperationInput(data, auth), auth);
    return result as any;
  } catch {
    return { success: false, error: "Não foi possível processar a troca." };
  }
}
