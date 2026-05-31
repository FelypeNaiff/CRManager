"use server";

import { salesService } from "../sales-service";

export async function listSalesAction(companyId: string, filters?: {
  sellerId?: string;
  customerId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const sales = await salesService.listSales(companyId, filters);
    return { success: true, sales };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
