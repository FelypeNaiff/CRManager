const fs = require('fs');

let content = fs.readFileSync('src/lib/crm/actions.ts', 'utf8');

const funcs = `
export async function listExchangeReturns() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.exchangeReturn.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { variant: { select: { name: true, product: { select: { name: true } } } } }
        }
      }
    });

    const customerIds = [...new Set(list.map((e: any) => e.customerId).filter(Boolean))] as string[];
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const mapped = list.map((e: any) => ({
      id: e.id,
      tipo: e.type,
      cliente_id: e.customerId,
      venda_id: e.originalSaleId,
      status: e.status,
      motivo: e.exchangeReason,
      valor_total: Number(e.totalCredit),
      valor_credito: Number(e.totalCredit),
      gera_credito: Number(e.totalCredit) > 0,
      observacao: "",
      created_at: e.createdAt,
      client: { nome: e.customerId ? (customerMap.get(e.customerId)?.name || "Consumidor") : "Consumidor" },
      product: { nome: e.items[0]?.variant?.product?.name || "Produto" },
      quantidade: e.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)
    }));

    return { success: true, data: mapped };
  } catch (error: any) {
    console.error("Error in listExchangeReturns:", error);
    return { success: false, error: error.message };
  }
}

export async function createExchangeReturnAction(data: any) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const { ExchangeService } = await import('@/lib/sales/exchange-service');
    const svc = new ExchangeService();
    const result = await svc.processExchangeReturn({
      companyId: session.companyId,
      saleId: data.venda_id,
      userId: session.userId,
      type: data.tipo,
      reason: data.motivo,
      items: [{
        variantId: data.produto_id,
        quantity: data.quantidade,
        condition: data.destino_produto === 'avaria' ? 'DAMAGED' : (data.destino_produto === 'descarte' ? 'DISCARD' : 'RESALE')
      }]
    });
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error creating exchange return:", error);
    return { success: false, error: error.message };
  }
}
`;

content += "\\n" + funcs;
fs.writeFileSync('src/lib/crm/actions.ts', content, 'utf8');
