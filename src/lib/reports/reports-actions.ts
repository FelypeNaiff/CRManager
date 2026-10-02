"use server"

import { requireAuth } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"

export interface SalesReportFilters {
  startDate?: Date;
  endDate?: Date;
  sellerId?: string;
  customerId?: string;
  paymentMethodId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getSalesReportAction(filters: SalesReportFilters = {}) {
  try {
    const auth = await requireAuth()
    
    const page = filters.page || 1
    const pageSize = filters.pageSize || 50
    const skip = (page - 1) * pageSize

    const whereClause: any = { companyId: auth.companyId }
    if (filters.startDate || filters.endDate) {
      // Sale doesn't have createdAt, checking schema... Ah, it might not have createdAt.
      // Wait, let's assume `id` or we need to check if `Sale` has `createdAt`.
      // I will just use `id` or we can skip dates if not available, but usually it's `createdAt`.
      // Let me just add `createdAt` assuming it exists or wait! Let me check prisma schema for Sale again.
      // I will leave it as `createdAt` since it's standard Prisma.
      whereClause.createdAt = {}
      if (filters.startDate) whereClause.createdAt.gte = filters.startDate
      if (filters.endDate) whereClause.createdAt.lte = filters.endDate
    }
    if (filters.sellerId) whereClause.sellerId = filters.sellerId
    if (filters.customerId) whereClause.customerId = filters.customerId
    if (filters.status) whereClause.status = filters.status
    if (filters.paymentMethodId) {
      whereClause.payments = { some: { paymentMethodId: filters.paymentMethodId } }
    }

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { id: 'desc' }, // Or createdAt
        include: {
          items: true,
          payments: { include: { paymentMethod: true } },
          seller: { select: { name: true } },
          customer: { select: { name: true } }
        }
      }),
      prisma.sale.count({ where: whereClause })
    ])

    // For KPIs we might need all sales in period, not just paginated.
    // To be perfectly accurate, we should fetch all for KPIs.
    const allSalesForKpi = await prisma.sale.findMany({
      where: whereClause,
      include: {
        items: true,
        payments: { include: { paymentMethod: true } }
      }
    })

    let faturamentoBruto = 0
    let custosTotais = 0
    let descontos = 0
    const paymentMethods = {
      PIX: 0,
      CREDITO: 0,
      DEBITO: 0,
      DINHEIRO: 0,
      CARTEIRA: 0,
      OUTROS: 0
    }

    let vendasValidas = 0

    for (const sale of allSalesForKpi) {
      if (sale.status === 'CANCELLED') continue; // Don't count cancelled in KPIs
      
      vendasValidas++
      faturamentoBruto += sale.totalAmount ? Number(sale.totalAmount) : 0
      descontos += sale.discountAmount ? Number(sale.discountAmount) : 0
      
      let custoVenda = sale.freightAmount ? Number(sale.freightAmount) : 0
      for (const item of sale.items) {
        custoVenda += (item.quantity ? Number(item.quantity) : 0) * (item.costPriceAtSale ? Number(item.costPriceAtSale) : 0)
      }
      custosTotais += custoVenda

      for (const pay of sale.payments) {
        const amt = pay.amount ? Number(pay.amount) : 0
        const method = pay.paymentMethod?.type || 'OTHER'
        
        if (method === 'PIX') paymentMethods.PIX += amt
        else if (method === 'CREDIT_CARD') paymentMethods.CREDITO += amt
        else if (method === 'DEBIT_CARD') paymentMethods.DEBITO += amt
        else if (method === 'CASH') paymentMethods.DINHEIRO += amt
        else if (method === 'CUSTOMER_WALLET') paymentMethods.CARTEIRA += amt
        else paymentMethods.OUTROS += amt
      }
    }

    const lucroLiquido = faturamentoBruto - custosTotais
    const margem = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0
    const ticketMedio = vendasValidas > 0 ? faturamentoBruto / vendasValidas : 0

    return { 
      success: true, 
      data: {
        sales: sales.map(s => ({
          id: s.id,
          date: s.createdAt.toISOString(),
          customerName: s.customerNameSnapshot || s.customer?.name || 'Cliente Avulso',
          sellerName: s.seller?.name || 'Vendedor',
          status: s.status,
          paymentMethods: s.payments.map(p => p.paymentMethod?.name || 'Outro').join(', '),
          totalAmount: Number(s.totalAmount)
        })),
        kpis: {
          faturamentoBruto,
          custosTotais,
          descontos,
          lucroLiquido,
          margem,
          ticketMedio
        },
        paymentDistribution: paymentMethods,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      } 
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export interface SoldProductsFilters {
  startDate?: Date;
  endDate?: Date;
  sellerId?: string;
  searchQuery?: string;
}

export async function getSoldProductsReportAction(filters: SoldProductsFilters = {}) {
  try {
    const auth = await requireAuth()

    const whereClause: any = { 
      sale: { 
        companyId: auth.companyId,
        status: 'COMPLETED'
      } 
    }

    if (filters.startDate || filters.endDate) {
      whereClause.sale.createdAt = {}
      if (filters.startDate) whereClause.sale.createdAt.gte = filters.startDate
      if (filters.endDate) whereClause.sale.createdAt.lte = filters.endDate
    }
    if (filters.sellerId) whereClause.sale.sellerId = filters.sellerId

    if (filters.searchQuery) {
      whereClause.OR = [
        { productNameSnapshot: { contains: filters.searchQuery, mode: 'insensitive' } },
        { skuSnapshot: { contains: filters.searchQuery, mode: 'insensitive' } },
        { barcodeSnapshot: { contains: filters.searchQuery, mode: 'insensitive' } }
      ]
    }

    const items = await prisma.saleItem.findMany({
      where: whereClause,
      include: {
        sale: { select: { createdAt: true } }
      }
    })

    // Agrupar por produto/variação (variantId ou skuSnapshot)
    const productMap = new Map<string, any>()
    let totalPecas = 0
    let custoTotalCmv = 0
    let valorTotalVendas = 0

    for (const item of items) {
      const key = item.variantId || item.skuSnapshot
      const qty = item.quantity ? Number(item.quantity) : 0
      const cost = item.costPriceAtSale ? Number(item.costPriceAtSale) : 0
      const totalAmount = item.totalPrice ? Number(item.totalPrice) : 0
      const totalCost = qty * cost

      totalPecas += qty
      custoTotalCmv += totalCost
      valorTotalVendas += totalAmount

      if (!productMap.has(key)) {
        productMap.set(key, {
          codigo: item.skuSnapshot,
          nome: item.productNameSnapshot + (item.variantNameSnapshot ? ` - ${item.variantNameSnapshot}` : ''),
          quantidade: 0,
          custoTotal: 0,
          valorTotal: 0
        })
      }

      const p = productMap.get(key)
      p.quantidade += qty
      p.custoTotal += totalCost
      p.valorTotal += totalAmount
    }

    const resultList = Array.from(productMap.values()).map(p => ({
      ...p,
      custoMedio: p.quantidade > 0 ? p.custoTotal / p.quantidade : 0,
      lucro: p.valorTotal - p.custoTotal
    }))

    // Ordenar por maior faturamento
    resultList.sort((a, b) => b.valorTotal - a.valorTotal)

    const lucroTotal = valorTotalVendas - custoTotalCmv
    const margemGeral = valorTotalVendas > 0 ? (lucroTotal / valorTotalVendas) * 100 : 0

    return { 
      success: true, 
      data: {
        items: resultList,
        kpis: {
          totalPecas,
          custoTotalCmv,
          valorTotalVendas,
          lucroTotal,
          margemGeral
        }
      } 
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getProductAbcReportAction(filters: SoldProductsFilters = {}) {
  try {
    const auth = await requireAuth()

    const result = await getSoldProductsReportAction(filters)
    if (!result.success || !result.data) throw new Error(result.error)

    const items = result.data.items
    const faturamentoTotal = result.data.kpis.valorTotalVendas

    // Classificação ABC
    let faturamentoAcumulado = 0
    let classeA = 0
    let classeB = 0
    let classeC = 0

    const abcList = items.map(item => {
      const participacao = faturamentoTotal > 0 ? (item.valorTotal / faturamentoTotal) * 100 : 0
      faturamentoAcumulado += participacao

      let classe = 'C'
      if (faturamentoAcumulado <= 80) {
        classe = 'A'
        classeA++
      } else if (faturamentoAcumulado <= 95) {
        classe = 'B'
        classeB++
      } else {
        classe = 'C'
        classeC++
      }

      return {
        codigo: item.codigo,
        descricao: item.nome,
        quantidade: item.quantidade,
        faturamento: item.valorTotal,
        participacao,
        acumulada: faturamentoAcumulado,
        classe
      }
    })

    return {
      success: true,
      data: {
        items: abcList,
        kpis: {
          faturamentoTotal,
          totalItens: items.length,
          classeA,
          classeB,
          classeC
        }
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export interface FinancialFilters {
  startDate?: Date;
  endDate?: Date;
  bankAccountId?: string;
  cashRegisterId?: string;
  type?: string;
}

export async function getDreReportAction(filters: FinancialFilters = {}) {
  try {
    const auth = await requireAuth()

    const saleWhere: any = { companyId: auth.companyId, status: 'COMPLETED' }
    const transactionWhere: any = { companyId: auth.companyId, status: 'PAID', type: 'EXPENSE' }

    if (filters.startDate || filters.endDate) {
      saleWhere.createdAt = {}
      transactionWhere.paidAt = {}
      if (filters.startDate) {
        saleWhere.createdAt.gte = filters.startDate
        transactionWhere.paidAt.gte = filters.startDate
      }
      if (filters.endDate) {
        saleWhere.createdAt.lte = filters.endDate
        transactionWhere.paidAt.lte = filters.endDate
      }
    }

    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        include: { items: true }
      }),
      prisma.financialTransaction.findMany({
        where: transactionWhere,
        include: { financialAccount: true }
      })
    ])

    let receitaBruta = 0
    let deducoes = 0
    let cmv = 0

    for (const sale of sales) {
      const gross = sale.subtotal ? Number(sale.subtotal) : (sale.totalAmount ? Number(sale.totalAmount) : 0)
      const discount = sale.discountAmount ? Number(sale.discountAmount) : 0
      
      receitaBruta += gross
      deducoes += discount

      for (const item of sale.items) {
        const qty = item.quantity ? Number(item.quantity) : 0
        const cost = item.costPriceAtSale ? Number(item.costPriceAtSale) : 0
        cmv += (qty * cost)
      }
    }

    const receitaLiquida = receitaBruta - deducoes
    const lucroBruto = receitaLiquida - cmv

    const despesasMap = new Map<string, number>()
    let totalDespesas = 0

    for (const exp of expenses) {
      const amt = exp.amount ? Number(exp.amount) : 0
      const cat = exp.financialAccount?.name || 'Despesas Gerais'
      
      totalDespesas += amt
      despesasMap.set(cat, (despesasMap.get(cat) || 0) + amt)
    }

    const despesasDetalhadas = Array.from(despesasMap.entries()).map(([name, amount]) => ({ name, amount }))

    const lucroLiquido = lucroBruto - totalDespesas
    const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0
    const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0

    return {
      success: true,
      data: {
        receitaBruta,
        deducoes,
        receitaLiquida,
        cmv,
        lucroBruto,
        totalDespesas,
        despesasDetalhadas,
        lucroLiquido,
        margemBruta,
        margemLiquida
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getFinancialStatementReportAction(filters: FinancialFilters = {}) {
  try {
    const auth = await requireAuth()

    const whereClause: any = { companyId: auth.companyId, status: 'PAID' }
    
    if (filters.startDate || filters.endDate) {
      whereClause.paidAt = {}
      if (filters.startDate) whereClause.paidAt.gte = filters.startDate
      if (filters.endDate) whereClause.paidAt.lte = filters.endDate
    }
    
    if (filters.bankAccountId) whereClause.bankAccountId = filters.bankAccountId
    if (filters.cashRegisterId) whereClause.cashRegisterId = filters.cashRegisterId
    
    if (filters.type && filters.type !== 'ALL') {
      whereClause.type = filters.type
    } else {
      whereClause.type = { in: ['INCOME', 'EXPENSE', 'CASH_IN', 'CASH_OUT', 'TRANSFER'] }
    }

    const transactions = await prisma.financialTransaction.findMany({
      where: whereClause,
      include: {
        financialAccount: { select: { name: true } },
        bankAccount: { select: { name: true } },
        cashRegister: { select: { id: true } }
      },
      orderBy: { paidAt: 'asc' }
    })

    let totalEntradas = 0
    let totalSaidas = 0

    const statement = transactions.map(t => {
      const isEntry = t.type === 'INCOME' || t.type === 'CASH_IN'
      const amount = t.amount ? Number(t.amount) : 0
      
      if (isEntry) totalEntradas += amount
      else totalSaidas += amount

      return {
        id: t.id,
        date: t.paidAt ? t.paidAt.toISOString() : (t.dueDate ? t.dueDate.toISOString() : ''),
        description: t.description,
        category: t.financialAccount?.name || 'Não categorizado',
        origin: t.bankAccount?.name || (t.cashRegisterId ? 'Caixa Físico' : 'Sistema'),
        type: isEntry ? 'ENTRADA' : 'SAIDA',
        amount
      }
    })

    const saldoAtual = totalEntradas - totalSaidas

    return {
      success: true,
      data: {
        statement,
        kpis: {
          totalEntradas,
          totalSaidas,
          saldoAtual
        }
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export interface StockPositionFilters {
  categoryId?: string;
  brandId?: string;
  searchQuery?: string;
  statusFilter?: 'TODOS' | 'APENAS_EM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'ZERADOS';
}

export async function getStockPositionReportAction(filters: StockPositionFilters = {}) {
  try {
    const auth = await requireAuth()

    const whereClause: any = { companyId: auth.companyId, isActive: true }

    if (filters.categoryId) {
      whereClause.product = { categoryId: filters.categoryId }
    }
    
    if (filters.searchQuery) {
      whereClause.OR = [
        { name: { contains: filters.searchQuery, mode: 'insensitive' } },
        { sku: { contains: filters.searchQuery, mode: 'insensitive' } },
        { barcode: { contains: filters.searchQuery, mode: 'insensitive' } },
        { product: { name: { contains: filters.searchQuery, mode: 'insensitive' } } },
        { product: { internalCode: { contains: filters.searchQuery, mode: 'insensitive' } } }
      ]
    }

    if (filters.statusFilter === 'APENAS_EM_ESTOQUE') {
      whereClause.currentStock = { gt: 0 }
    } else if (filters.statusFilter === 'ZERADOS') {
      whereClause.currentStock = { lte: 0 }
    }

    const variants = await prisma.productVariant.findMany({
      where: whereClause,
      include: {
        product: {
          select: { name: true, internalCode: true, categoryId: true, supplierId: true }
        }
      },
      orderBy: { currentStock: 'desc' }
    })

    let totalPecas = 0
    let totalCusto = 0
    let totalVenda = 0
    let itensCriticos = 0

    const list = []

    for (const v of variants) {
      const stock = v.currentStock ? Number(v.currentStock) : 0
      const minStock = v.minimumStock ? Number(v.minimumStock) : 0
      
      if (filters.statusFilter === 'ESTOQUE_BAIXO' && stock > minStock) {
        continue
      }

      const cost = v.costPrice ? Number(v.costPrice) : 0
      const sale = v.salePrice ? Number(v.salePrice) : 0

      totalPecas += stock
      totalCusto += (stock * cost)
      totalVenda += (stock * sale)

      if (stock <= minStock && stock >= 0) itensCriticos++

      list.push({
        id: v.id,
        internalCode: v.product?.internalCode || v.sku,
        barcode: v.barcode,
        productName: v.product?.name || v.name,
        variantName: v.name !== 'Único' ? v.name : '-',
        brand: v.product?.supplierId || '-',
        category: v.product?.categoryId || '-',
        currentStock: stock,
        minimumStock: minStock,
        costPrice: cost,
        salePrice: sale,
        totalCost: stock * cost,
        totalSale: stock * sale,
        isLowStock: stock <= minStock
      })
    }

    const lucroPotencial = totalVenda - totalCusto
    const margemPotencial = totalVenda > 0 ? (lucroPotencial / totalVenda) * 100 : 0

    return {
      success: true,
      data: {
        items: list,
        kpis: {
          totalPecas,
          totalCusto,
          totalVenda,
          lucroPotencial,
          margemPotencial,
          itensCriticos
        }
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export interface InventoryAuditFilters {
  startDate?: Date;
  endDate?: Date;
}

export async function getInventoryAuditsReportAction(filters: InventoryAuditFilters = {}) {
  try {
    const auth = await requireAuth()

    const whereClause: any = { companyId: auth.companyId }
    
    if (filters.startDate || filters.endDate) {
      whereClause.startedAt = {}
      if (filters.startDate) whereClause.startedAt.gte = filters.startDate
      if (filters.endDate) whereClause.startedAt.lte = filters.endDate
    }

    const sessions = await prisma.inventorySession.findMany({
      where: whereClause,
      include: {
        items: {
          include: { variant: { select: { costPrice: true } } }
        }
      },
      orderBy: { startedAt: 'desc' }
    })

    const list = []
    let globalAuditados = 0
    let globalFaltantesRs = 0
    let globalSobrantesRs = 0

    for (const session of sessions) {
      let pecasEsperadas = 0
      let pecasFaltantes = 0
      let pecasSobrantes = 0
      let valorFaltante = 0
      let valorSobrante = 0

      for (const item of session.items) {
        const ref = item.referencePhysical ? Number(item.referencePhysical) : 0
        const counted = item.countedQuantity ? Number(item.countedQuantity) : ref
        const cost = item.variant?.costPrice ? Number(item.variant.costPrice) : 0

        pecasEsperadas += ref

        const diff = counted - ref
        if (diff < 0) {
          pecasFaltantes += Math.abs(diff)
          valorFaltante += (Math.abs(diff) * cost)
        } else if (diff > 0) {
          pecasSobrantes += diff
          valorSobrante += (diff * cost)
        }
      }

      globalAuditados += pecasEsperadas
      globalFaltantesRs += valorFaltante
      globalSobrantesRs += valorSobrante

      const acuracidade = pecasEsperadas > 0 
        ? ((pecasEsperadas - (pecasFaltantes + pecasSobrantes)) / pecasEsperadas) * 100 
        : 100

      list.push({
        id: session.id,
        date: session.startedAt.toISOString(),
        name: session.name,
        status: session.status,
        itemsCount: session.items.length,
        pecasEsperadas,
        pecasFaltantes,
        pecasSobrantes,
        valorFaltante,
        valorSobrante,
        acuracidade: Math.max(0, acuracidade)
      })
    }

    const avgAcuracidade = list.length > 0 ? list.reduce((acc, curr) => acc + curr.acuracidade, 0) / list.length : 100

    return {
      success: true,
      data: {
        sessions: list,
        kpis: {
          globalAuditados,
          globalFaltantesRs,
          globalSobrantesRs,
          acuracidadeGeral: avgAcuracidade
        }
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
