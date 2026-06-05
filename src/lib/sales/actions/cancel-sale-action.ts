'use server';
import { serializePrisma } from '@/lib/serialize';

import { revalidatePath } from "next/cache";
import { salesService } from "../sales-service";
import { CancelSaleInput, cancelSaleSchema } from "../sales-schemas";

export async function cancelSaleAction(data: CancelSaleInput) {
  try {
    const validatedData = cancelSaleSchema.parse(data);
    const result = await salesService.cancelSale(validatedData);
    if (result && 'requireAuthorization' in result) {
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
    }
    revalidatePath("/comercial/vendas");
    revalidatePath(`/comercial/vendas/${data.saleId}`);
    return { success: true, sale: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
