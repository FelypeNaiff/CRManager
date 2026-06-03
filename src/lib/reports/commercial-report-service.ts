import { PrismaClient, SaleStatus } from "@prisma/client";

const prisma = new PrismaClient();

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
    
    const sales = await prisma.sale.findMany({
      where: {
        companyId: filters.companyId,
        ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
        ...dateFilter,
      },
      include: { items: true, payments: true }
    });

    let grossRevenue = 0;
    let netRevenue = 0;
    let totalDiscount = 0;
    let totalCost = 0;
    let totalSalesCount = 0;

    const paymentsByType: Record<string, number> = {};

    for (const sale of sales) {
      if (sale.status !== "CANCELLED") {
        totalSalesCount++;
        grossRevenue += sale.subtotal.toNumber();
        totalDiscount += sale.discountAmount.toNumber();
        netRevenue += sale.totalAmount.toNumber();
        
        for (const item of sale.items) {
          totalCost += (item.costPriceAtSale.toNumber() * item.quantity.toNumber());
        }

        for (const pay of sale.payments) {
          if (pay.status === "PAID" || pay.status === "PENDING") { // simplified assumption for metrics
            paymentsByType[pay.paymentMethodId] = (paymentsByType[pay.paymentMethodId] || 0) + pay.amount.toNumber();
          }
        }
      }
    }

    const salesForMetrics = await prisma.sale.findMany({
      where: { companyId: filters.companyId, ...dateFilter },
      select: { id: true }
    });
    const saleIdsForMetrics = salesForMetrics.map(s => s.id);

    const exchangesCount = await prisma.saleExchange.count({
      where: { originalSaleId: { in: saleIdsForMetrics } }
    });
    const returnsCount = await prisma.saleReturn.count({
      where: { originalSaleId: { in: saleIdsForMetrics } }
    });

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
      include: { variant: { include: { product: true } } }
    });

    const productsMap = new Map<string, any>();

    for (const item of saleItems) {
      if (!item.variant) continue;
      const key = item.variantId;
      if (!productsMap.has(key)) {
        productsMap.set(key, {
          productId: item.variant.productId,
          productName: item.productNameSnapshot,
          variantName: item.variantNameSnapshot,
          sku: item.skuSnapshot,
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          currentStock: item.variant.currentStock,
        });
      }
      
      const p = productsMap.get(key);
      p.quantitySold += item.quantity.toNumber();
      p.revenue += item.totalPrice.toNumber();
      p.cost += (item.costPriceAtSale.toNumber() * item.quantity.toNumber());
    }

    const result = Array.from(productsMap.values()).map(p => {
      const margin = p.revenue - p.cost;
      return {
        ...p,
        margin,
        marginPercent: p.revenue > 0 ? (margin / p.revenue) * 100 : 0
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

    const parseNotesAndItems = (notes: string | null, type: "EXCHANGE" | "RETURN", date: Date, id: string, amount: number) => {
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
      parseNotesAndItems(ex.notes, "EXCHANGE", ex.createdAt, ex.id, Number(ex.creditGenerated))
    );

    const mappedReturns = returns.map(ret => 
      parseNotesAndItems(ret.notes, "RETURN", ret.createdAt, ret.id, Number(ret.totalAmount))
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
