'use server';
import { serializePrisma } from '@/lib/serialize';

import { salesService } from "../sales-service";
import { requirePermission } from "@/lib/auth/permissions";

export async function getSaleAction(saleId: string) {
  try {
    const auth = await requirePermission("VENDAS", "VIEW");
    const sale = await salesService.getSaleById(saleId, auth.companyId);
    if (!sale) return { success: false, error: "Venda não encontrada." };
    return { success: true, sale };
  } catch {
    return { success: false, error: "Venda não encontrada." };
  }
}
