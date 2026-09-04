import { CreateSaleInput, createSaleSchema, CancelSaleInput, cancelSaleSchema } from '../sales-schemas';
import { scopeCancelSaleInput, scopeCreateSaleInput } from '../sales-tenant-security';

export function createCreateSaleAction(deps: any) {
  return async (data: CreateSaleInput) => {
    try {
      const auth = await deps.authorize([{ module: 'PDV', action: 'CREATE_SALE' }, { module: 'VENDAS', action: 'CREATE' }]);
      const normalizedData = {
        ...scopeCreateSaleInput(data, auth),
        items: data.items?.map(item => ({ ...item, barcodeSnapshot: item.barcodeSnapshot ?? '', skuSnapshot: item.skuSnapshot ?? '', productNameSnapshot: item.productNameSnapshot ?? 'Produto sem nome', variantNameSnapshot: item.variantNameSnapshot ?? '' })) || [],
      };
      const result = await deps.service.createSale(createSaleSchema.parse(normalizedData), auth.userId);
      if (result && 'requireAuthorization' in result) return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
      try { deps.revalidate('sales-reports'); deps.revalidate('crm-segmentation'); } catch { /* CLI/test mode */ }
      return { success: true, sale: result };
    } catch {
      return { success: false, error: 'Não foi possível registrar a venda.' };
    }
  };
}

export function createCancelSaleAction(deps: any) {
  return async (data: CancelSaleInput) => {
    try {
      const auth = await deps.authorize([{ module: 'PDV', action: 'CANCEL_SALE' }, { module: 'VENDAS', action: 'CANCEL' }]);
      const result = await deps.service.cancelSale(cancelSaleSchema.parse(scopeCancelSaleInput(data, auth)), auth.companyId);
      if (result && 'requireAuthorization' in result) return { success: false, requireAuthorization: true, authorizationId: result.authorizationId };
      deps.revalidateTag('sales-reports'); deps.revalidateTag('crm-segmentation');
      deps.revalidatePath('/comercial/vendas'); deps.revalidatePath(`/comercial/vendas/${data.saleId}`);
      return { success: true, sale: result };
    } catch {
      return { success: false, error: 'Não foi possível cancelar a venda.' };
    }
  };
}

export function createGetSaleAction(deps: any) {
  return async (saleId: string) => {
    try {
      const auth = await deps.authorize('VENDAS', 'VIEW');
      const sale = await deps.service.getSaleById(saleId, auth.companyId);
      return sale ? { success: true, sale } : { success: false, error: 'Venda não encontrada.' };
    } catch { return { success: false, error: 'Venda não encontrada.' }; }
  };
}

export type ListSalesFilters = { sellerId?: string; customerId?: string; status?: string; startDate?: Date; endDate?: Date; page?: number; pageSize?: number };

export function createListSalesAction(deps: any) {
  return async (_companyId: string, filters?: ListSalesFilters) => {
    try {
      const auth = await deps.authorize('VENDAS', 'VIEW');
      return { success: true, ...await deps.service.listSales(auth.companyId, filters) };
    } catch { return { success: false, error: 'Não foi possível listar as vendas.' }; }
  };
}
