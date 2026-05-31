export class SalesAdapter {
  mapSaleToUI(sale: any) {
    // FASE 6A: Estrutural
    return {
      id: sale.id,
      total: sale.totalAmount,
      status: sale.status,
      customerName: sale.customerNameSnapshot
    };
  }
}

export const salesAdapter = new SalesAdapter();
