const fs = require('fs');

let content = fs.readFileSync('src/lib/crm/actions.ts', 'utf8');

// replace the listExchangeReturns
content = content.replace(
  /export async function listExchangeReturns\([\s\S]*?\}\s*\n/m,
  `export async function listExchangeReturns() {
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

    const customerIds = [...new Set(list.map(e => e.customerId).filter(Boolean))] as string[];
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const mapped = list.map(e => ({
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
      quantidade: e.items.reduce((acc, i) => acc + Number(i.quantity), 0)
    }));

    return { success: true, data: mapped };
  } catch (error: any) {
    console.error("Error in listExchangeReturns:", error);
    return { success: false, error: error.message };
  }
}
`
);

fs.writeFileSync('src/lib/crm/actions.ts', content, 'utf8');
