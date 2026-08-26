'use server';

import { requireAnyPermission } from "@/lib/auth/permissions";
import { salesService } from "../sales-service";
import { CreateSaleInput, createSaleSchema } from "../sales-schemas";
import { revalidateTag } from "next/cache";
import { scopeCreateSaleInput } from "../sales-tenant-security";

export async function createSaleAction(data: CreateSaleInput) {
  try {
    const auth = await requireAnyPermission([
      { module: "PDV", action: "CREATE_SALE" },
      { module: "VENDAS", action: "CREATE" },
    ]);

    const normalizedData = {
      ...scopeCreateSaleInput(data, auth),
      items: data.items?.map(item => ({
        ...item,
        barcodeSnapshot: item.barcodeSnapshot ?? "",
        skuSnapshot: item.skuSnapshot ?? "",
        productNameSnapshot: item.productNameSnapshot ?? "Produto sem nome",
        variantNameSnapshot: item.variantNameSnapshot ?? "",
      })) || []
    };

    const validatedData = createSaleSchema.parse(normalizedData);
    const result = await salesService.createSale(validatedData, auth.userId);
    
    if (result && 'requireAuthorization' in result) {
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
    }

    // Purge cache tags on successful sale
    try {
      revalidateTag("sales-reports");
      revalidateTag("crm-segmentation");
    } catch (e) {
      console.log("revalidateTag ignored in test/CLI mode");
    }

    return { success: true, sale: result };
  } catch {
    return { success: false, error: "Não foi possível registrar a venda." };
  }
}
