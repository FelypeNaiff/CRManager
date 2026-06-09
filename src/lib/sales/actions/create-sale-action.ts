'use server';

import { getActiveProfileSession } from "@/lib/auth/actions";
import { salesService } from "../sales-service";
import { CreateSaleInput, createSaleSchema } from "../sales-schemas";
import { revalidateTag } from "next/cache";

export async function createSaleAction(data: CreateSaleInput) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    action: "CREATE_SALE_REQUEST",
    companyId: data.companyId,
    sellerId: data.sellerId,
    customerId: data.customerId || null,
    totalAmount: data.totalAmount
  }));

  try {
    const session = await getActiveProfileSession();
    if (!session?.userId) throw new Error("Usuário não autenticado");

    const normalizedData = {
      ...data,
      items: data.items?.map(item => ({
        ...item,
        barcodeSnapshot: item.barcodeSnapshot ?? "",
        skuSnapshot: item.skuSnapshot ?? "",
        productNameSnapshot: item.productNameSnapshot ?? "Produto sem nome",
        variantNameSnapshot: item.variantNameSnapshot ?? "",
      })) || []
    };

    const validatedData = createSaleSchema.parse(normalizedData);
    const result = await salesService.createSale(validatedData, session.userId);
    
    if (result && 'requireAuthorization' in result) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        action: "CREATE_SALE_REQUIRES_AUTH",
        authorizationId: result.authorizationId
      }));
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
    }

    // Purge cache tags on successful sale
    try {
      revalidateTag("sales-reports");
      revalidateTag("crm-segmentation");
    } catch (e) {
      console.log("revalidateTag ignored in test/CLI mode");
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      action: "CREATE_SALE_SUCCESS",
      saleId: result.id,
      totalAmount: result.totalAmount
    }));

    return { success: true, sale: result };
  } catch (error: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      action: "CREATE_SALE_FAILURE",
      error: error.message
    }));
    return { success: false, error: error.message };
  }
}
