"use server";

import { salesService } from "../sales-service";
import { CreateSaleInput, createSaleSchema } from "../sales-schemas";

export async function createSaleAction(data: CreateSaleInput) {
  try {
    const validatedData = createSaleSchema.parse(data);
    const result = await salesService.createSale(validatedData);
    if (result && 'requireAuthorization' in result) {
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
    }
    return { success: true, sale: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
