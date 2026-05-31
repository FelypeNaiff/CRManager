"use server";

import { salesService } from "../sales-service";
import { CancelSaleInput, cancelSaleSchema } from "../sales-schemas";

export async function cancelSaleAction(data: CancelSaleInput) {
  try {
    const validatedData = cancelSaleSchema.parse(data);
    const sale = await salesService.cancelSale(validatedData);
    return { success: true, sale };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
