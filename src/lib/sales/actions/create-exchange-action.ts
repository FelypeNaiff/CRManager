"use server";

import { ExchangeService, ProcessExchangeReturnInput } from "../exchange-service";

export async function processExchangeReturnAction(data: ProcessExchangeReturnInput): Promise<{ success: true; exchangeReturn: any; totalCredit: number } | { success: false; error: string }> {
  try {
    const exchangeService = new ExchangeService();
    const result = await exchangeService.processExchangeReturn(data);
    return result as any;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
