"use server";

import { salesService } from "../sales-service";

export async function listSalesAction(companyId: string, filters?: {
  sellerId?: string;
  customerId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  try {
    const result = await salesService.listSales(companyId, filters);
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
