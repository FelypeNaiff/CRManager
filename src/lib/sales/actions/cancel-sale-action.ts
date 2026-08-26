'use server';

import { revalidatePath, revalidateTag } from "next/cache";
import { salesService } from "../sales-service";
import { CancelSaleInput, cancelSaleSchema } from "../sales-schemas";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { scopeCancelSaleInput } from "../sales-tenant-security";

export async function cancelSaleAction(data: CancelSaleInput) {
  try {
    const auth = await requireAnyPermission([
      { module: "PDV", action: "CANCEL_SALE" },
      { module: "VENDAS", action: "CANCEL" },
    ]);
    const validatedData = cancelSaleSchema.parse(scopeCancelSaleInput(data, auth));
    const result = await salesService.cancelSale(validatedData, auth.companyId);
    
    if (result && 'requireAuthorization' in result) {
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
    }

    // Purge cache tags on successful sale cancellation
    revalidateTag("sales-reports");
    revalidateTag("crm-segmentation");

    revalidatePath("/comercial/vendas");
    revalidatePath(`/comercial/vendas/${data.saleId}`);

    return { success: true, sale: result };
  } catch {
    return { success: false, error: "Não foi possível cancelar a venda." };
  }
}
