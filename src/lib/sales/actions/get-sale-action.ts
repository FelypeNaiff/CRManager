'use server';
import { serializePrisma } from '@/lib/serialize';

import { salesService } from "../sales-service";

export async function getSaleAction(saleId: string) {
  try {
    const sale = await salesService.getSaleById(saleId);
    if (!sale) return { success: false, error: "Venda não encontrada." };
    return { success: true, sale };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
