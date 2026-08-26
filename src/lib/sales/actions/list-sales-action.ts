'use server';
import { serializePrisma } from '@/lib/serialize';

import { salesService } from "../sales-service";
import { requirePermission } from "@/lib/auth/permissions";

export async function listSalesAction(_companyId: string, filters?: {
  sellerId?: string;
  customerId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  try {
    const auth = await requirePermission("VENDAS", "VIEW");
    const result = await salesService.listSales(auth.companyId, filters);
    return { success: true, ...result };
  } catch {
    return { success: false, error: "Não foi possível listar as vendas." };
  }
}
