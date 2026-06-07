import { SaleStatus, Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma';

export interface ReportFilters {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
  sellerId?: string;
  customerId?: string;
  status?: string;
}

export class CommercialReportService {
  
  private getDateFilter(filters: ReportFilters) {
    if (filters.startDate || filters.endDate) {
      return {
        createdAt: {
          ...(filters.startDate ? { gte: filters.startDate } : {}),
          ...(filters.endDate ? { lte: filters.endDate } : {}),
        }
      };
    }
    return {};
  }

  // 1. Dashboard Comercial
  async getDashboardMetrics(filters: ReportFilters) {
    const dateFilter = this.getDateFilter(filters);
    
    const aggregated = await prisma.sale.aggregate({
      where: {
        companyId: filters.companyId,
        status: { not: "CANCELLED" },
        ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
        ...dateFilter,
      },
      _sum: {
        subtotal: true,
        discountAmount: true,
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    const grossRevenue = aggregated._sum.subtotal ? Number(aggregated._sum.subtotal) : 0;
    const totalDiscount = aggregated._sum.discountAmount ? Number(aggregated._sum.discountAmount) : 0;
    const netRevenue = aggregated._sum.totalAmount ? Number(aggregated._sum.totalAmount) : 0;
    const totalSalesCount = aggregated._count.id || 0;

    const sellerCondition = filters.sellerId ? Prisma.sql`AND s.seller_id = ${filters.sellerId}` : Prisma.empty;
    const startCondition = filters.startDate ? Prisma.sql`AND s.created_at >= ${filters.startDate}` : Prisma.empty;
    const endCondition = filters.endDate ? Prisma.sql`AND s.created_at <= ${filters.endDate}` : Prisma.empty;

    const costRes = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(SUM(si.cost_price_at_sale * si.quantity), 0) as "totalCost"
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.company_id = ${filters.companyId}
        AND s.status <> 'CANCELLED'
        ${sellerCondition}
        ${startCondition}
        ${endCondition}
    `;
    const totalCost = Number(costRes[0]?.totalCost || 0);

    const paymentsGrouped = await prisma.salePayment.groupBy({
      by: ['paymentMethodId'],
      where: {
        sale: {
          companyId: filters.companyId,
          status: { not: 'CANCELLED' },
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...dateFilter
        },
        status: { in: ['PAID', 'PENDING'] }
      },
      _sum: {
        amount: true
      }
    });

    const paymentsByType: Record<string, number> = {};
    paymentsGrouped.forEach(pg => {
      paymentsByType[pg.paymentMethodId] = pg._sum.amount ? Number(pg._sum.amount) : 0;
    });

    const exchangesRes = await prisma.$queryRaw<any[]>`
      SELECT COUNT(se.id) as "count"
      FROM sale_exchanges se
      JOIN sales s ON se.original_sale_id = s.id
      WHERE s.company_id = ${filters.companyId}
        ${sellerCondition}
        ${startCondition}
        ${endCondition}
    `;
    const exchangesCount = Number(exchangesRes[0]?.count || 0);

    const returnsRes = await prisma.$queryRaw<any[]>`
      SELECT COUNT(sr.id) as "count"
      FROM sale_returns sr
      JOIN sales s ON sr.original_sale_id = s.id
      WHERE s.company_id = ${filters.companyId}
        ${sellerCondition}
        ${startCondition}
        ${endCondition}
    `;
    const returnsCount = Number(returnsRes[0]?.count || 0);

    const totalReturns = returnsCount;
    const totalExchanges = exchangesCount;

    const ticketMedio = totalSalesCount > 0 ? netRevenue / totalSalesCount : 0;
    const margemBruta = netRevenue - totalCost;
    const margemPercentual = netRevenue > 0 ? (margemBruta / netRevenue) * 100 : 0;

    return {
      grossRevenue,
      netRevenue,
      totalSalesCount,
      ticketMedio,
      totalDiscount,
      totalReturns,
      totalExchanges,
      margemBruta,
      margemPercentual,
      paymentsByType
    };
  }

  // 2. Relatório de Vendas
  async getSalesReport(filters: ReportFilters) {
    const dateFilter = this.getDateFilter(filters);
    
    const sales = await prisma.sale.findMany({
      where: {
        companyId: filters.companyId,
        ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.status ? { status: filters.status as SaleStatus } : {}),
        ...dateFilter,
      },
      include: {
        customer: { select: { name: true } },
        seller: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    return sales.map(s => ({
      id: s.id,
      date: s.createdAt,
      customerName: s.customerNameSnapshot || s.customer?.name || "Consumidor Final",
      sellerName: s.seller?.name || "Desconhecido",
      subtotal: s.subtotal.toNumber(),
      discount: s.discountAmount.toNumber(),
      total: s.totalAmount.toNumber(),
      status: s.status,
    }));
  }

  // 3. Relatório de Produtos Mais Vendidos
  async getTopProductsReport(filters: ReportFilters) {
    const sellerCondition = filters.sellerId ? Prisma.sql`AND s.seller_id = ${filters.sellerId}` : Prisma.empty;
    const startCondition = filters.startDate ? Prisma.sql`AND s.created_at >= ${filters.startDate}` : Prisma.empty;
    const endCondition = filters.endDate ? Prisma.sql`AND s.created_at <= ${filters.endDate}` : Prisma.empty;

    const topProducts = await prisma.$queryRaw<any[]>`
      SELECT 
        si.variant_id as "variantId",
        pv.product_id as "productId",
        MAX(si.product_name_snapshot) as "productName",
        MAX(si.variant_name_snapshot) as "variantName",
        MAX(si.sku_snapshot) as "sku",
        CAST(pv.current_stock AS double precision) as "currentStock",
        CAST(SUM(si.quantity) AS double precision) as "quantitySold",
        CAST(SUM(si.total_price) AS double precision) as "revenue",
        CAST(SUM(si.cost_price_at_sale * si.quantity) AS double precision) as "cost"
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN product_variants pv ON si.variant_id = pv.id
      WHERE s.company_id = ${filters.companyId}
        AND s.status <> 'CANCELLED'
        ${sellerCondition}
        ${startCondition}
        ${endCondition}
      GROUP BY si.variant_id, pv.product_id, pv.current_stock
    `;

    const result = topProducts.map(p => {
      const revenue = p.revenue || 0;
      const cost = p.cost || 0;
      const margin = revenue - cost;
      return {
        variantId: p.variantId,
        productId: p.productId,
        productName: p.productName,
        variantName: p.variantName,
        sku: p.sku,
        quantitySold: p.quantitySold || 0,
        revenue,
        cost,
        currentStock: p.currentStock || 0,
        margin,
        marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0
      };
    });

    return result.sort((a, b) => b.quantitySold - a.quantitySold);
  }

  // 4. Relatório de Margem
  async getMarginReport(filters: ReportFilters) {
    const dateFilter = this.getDateFilter(filters);
    
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          companyId: filters.companyId,
          status: { not: "CANCELLED" },
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...dateFilter,
        }
      },
      include: {
        sale: { select: { createdAt: true, seller: { select: { name: true } } } }
      },
      orderBy: { sale: { createdAt: 'desc' } }
    });

    return saleItems.map(item => ({
      saleId: item.saleId,
      date: item.sale.createdAt,
      product: item.productNameSnapshot,
      variant: item.variantNameSnapshot,
      seller: item.sale.seller?.name,
      quantity: item.quantity.toNumber(),
      costPrice: item.costPriceAtSale.toNumber(),
      salePrice: item.salePriceAtSale.toNumber(),
      marginPercent: item.marginAtSale.toNumber(), // recorded at sale
      totalCost: item.costPriceAtSale.toNumber() * item.quantity.toNumber(),
      totalRevenue: item.totalPrice.toNumber()
    }));
  }

  // 5. Relatório de Metas e Comissões
  async getGoalsAndCommissionsReport(filters: ReportFilters) {
    const goals = await prisma.sellerGoal.findMany({
      where: {
        user: { companyId: filters.companyId },
        ...(filters.sellerId ? { userId: filters.sellerId } : {}),
      },
      include: { user: { select: { name: true } } }
    });

    const commissions = await prisma.sellerCommission.findMany({
      where: {
        user: { companyId: filters.companyId },
        ...(filters.sellerId ? { userId: filters.sellerId } : {}),
        sale: {
          ...(filters.startDate || filters.endDate ? this.getDateFilter(filters) : {})
        }
      }
    });

    const userStats = new Map<string, any>();

    for (const g of goals) {
      if (!userStats.has(g.userId)) {
        userStats.set(g.userId, { sellerName: g.user.name, target: 0, achieved: 0, pendingComm: 0, paidComm: 0, cancelledComm: 0 });
      }
      const u = userStats.get(g.userId);
      u.target += g.targetAmount.toNumber();
      u.achieved += g.achievedAmount.toNumber();
    }

    for (const c of commissions) {
      if (!userStats.has(c.userId)) continue; // Only tracking those with goals or we should init others too
      const u = userStats.get(c.userId);
      const amt = c.amount.toNumber();
      if (c.status === "PENDING") u.pendingComm += amt;
      if (c.status === "PAID") u.paidComm += amt;
      if (c.status === "CANCELLED") u.cancelledComm += amt;
    }

    return Array.from(userStats.values()).map(u => ({
      ...u,
      percentAchieved: u.target > 0 ? (u.achieved / u.target) * 100 : 0
    })).sort((a, b) => b.percentAchieved - a.percentAchieved); // ranking by % achieved
  }

  // 6. Relatório de Trocas e Devoluções
  async getReturnsReport(filters: ReportFilters) {
    const dateFilter = this.getDateFilter(filters);
    
    const sales = await prisma.sale.findMany({
      where: { companyId: filters.companyId, ...dateFilter },
      select: { id: true }
    });
    const saleIds = sales.map(s => s.id);

    const exchanges = await prisma.saleExchange.findMany({
      where: { originalSaleId: { in: saleIds } },
      orderBy: { createdAt: 'desc' }
    });

    const returns = await prisma.saleReturn.findMany({
      where: { originalSaleId: { in: saleIds } },
      orderBy: { createdAt: 'desc' }
    });

    let totalReturned = 0;
    const reasonsMap = new Map<string, number>();
    const itemsMap = new Map<string, number>();

    const parseNãotesAndItems = (notes: string | null, type: "EXCHANGE" | "RETURN", date: Date, id: string, amount: number) => {
      let reason = "Não informado";
      let itemsList: any[] = [];
      try {
        if (notes) {
          const parsed = JSON.parse(notes);
          reason = parsed.reason || "Não informado";
          itemsList = parsed.items || [];
        }
      } catch {
        reason = notes || "Não informado";
      }

      totalReturned += amount;
      reasonsMap.set(reason, (reasonsMap.get(reason) || 0) + 1);

      for (const item of itemsList) {
        itemsMap.set(item.variantId, (itemsMap.get(item.variantId) || 0) + Number(item.quantity));
      }

      return {
        id,
        date,
        type,
        reason,
        creditGenerated: amount,
        status: notes?.startsWith("[CANCELADO]") ? "CANCELLED" : "COMPLETED"
      };
    };

    const mappedExchanges = exchanges.map(ex => 
      parseNãotesAndItems(ex.notes, "EXCHANGE", ex.createdAt, ex.id, Number(ex.creditGenerated))
    );

    const mappedReturns = returns.map(ret => 
      parseNãotesAndItems(ret.notes, "RETURN", ret.createdAt, ret.id, Number(ret.totalAmount))
    );

    const combinedList = [...mappedExchanges, ...mappedReturns].sort((a, b) => 
      b.date.getTime() - a.date.getTime()
    );

    return {
      returnsList: combinedList,
      totalReturned,
      reasonsMap: Object.fromEntries(reasonsMap),
      itemsCountMap: Object.fromEntries(itemsMap)
    };
  }

  // 7. Relatório de Créditos de Clientes
  async getCustomerCreditsReport(filters: ReportFilters) {
    const wallets = await prisma.customerWallet.findMany({
      where: {
        customer: {
          companyId: filters.companyId,
          ...(filters.customerId ? { id: filters.customerId } : {})
        }
      },
      include: { customer: { select: { name: true, email: true } } },
      orderBy: { balance: 'desc' }
    });

    let totalBalance = 0;
    const list = wallets.map(w => {
      const bal = w.balance.toNumber();
      totalBalance += bal;
      return {
        customerId: w.customerId,
        customerName: w.customer.name,
        customerEmail: w.customer.email,
        balance: bal,
        updatedAt: w.updatedAt
      };
    }).filter(w => w.balance > 0);

    return {
      totalBalance,
      customersWithBalance: list
    };
  }
}
