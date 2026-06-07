'use server';

import { revalidatePath, revalidateTag } from "next/cache";
import { salesService } from "../sales-service";
import { CancelSaleInput, cancelSaleSchema } from "../sales-schemas";

export async function cancelSaleAction(data: CancelSaleInput) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    action: "CANCEL_SALE_REQUEST",
    saleId: data.saleId,
    cancelledByUserId: data.cancelledByUserId
  }));

  try {
    const validatedData = cancelSaleSchema.parse(data);
    const result = await salesService.cancelSale(validatedData);
    
    if (result && 'requireAuthorization' in result) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        action: "CANCEL_SALE_REQUIRES_AUTH",
        authorizationId: result.authorizationId
      }));
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
    }

    // Purge cache tags on successful sale cancellation
    revalidateTag("sales-reports");
    revalidateTag("crm-segmentation");

    revalidatePath("/comercial/vendas");
    revalidatePath(`/comercial/vendas/${data.saleId}`);

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      action: "CANCEL_SALE_SUCCESS",
      saleId: data.saleId
    }));

    return { success: true, sale: result };
  } catch (error: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      action: "CANCEL_SALE_FAILURE",
      saleId: data.saleId,
      error: error.message
    }));
    return { success: false, error: error.message };
  }
}
