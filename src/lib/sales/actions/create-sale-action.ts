"use server";

import { salesService } from "../sales-service";
import { CreateSaleInput, createSaleSchema } from "../sales-schemas";

export async function createSaleAction(data: CreateSaleInput) {
  try {
    const validatedData = createSaleSchema.parse(data);
    const sale = await salesService.createSale(validatedData);
    return { success: true, sale };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
