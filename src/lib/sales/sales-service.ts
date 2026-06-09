import { AuthorizationType } from "@prisma/client";
import { CreateSaleInput, CancelSaleInput } from "./sales-schemas";
import { sellerCommissionService } from "./seller-commission-service";
import { OperationalSettingsService } from "../configuracoes/operational-settings-service";
import { authorizationService } from "../auth/authorization-service";
import { receivablesService } from "../financial/receivables-service";
import { getPaginationArgs, buildPaginatedResult, PaginationParams } from "../performance/pagination";
import { prisma } from "@/lib/prisma";

import bcrypt from "bcryptjs";

export class SalesService {
  async createSale(data: CreateSaleInput, operatorUserId: string) {
    return prisma.$transaction(async (tx) => {
      // Etapa 1: Validar empresa, vendedor, cliente, caixa
      const company = await tx.company.findUnique({ where: { id: data.companyId } });
      if (!company) throw new Error("Empresa inválida.");

      const seller = await tx.seller.findUnique({ where: { id: data.sellerId } });
      if (!seller) throw new Error("Vendedor inválido.");

      if (data.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
        if (!customer) throw new Error("Cliente inválido.");
      }

      // Carregar configurações operacionais da empresa
      const settings = await OperationalSettingsService.getOrCreateOperationalSettings(data.companyId, tx);

      // Validar Caixa Aberto se exigido pelas configurações operacionais
      if (settings.requireOpenCashRegister) {
        if (!data.cashRegisterId) {
          const activeRegister = await tx.cashRegister.findFirst({
            where: { companyId: data.companyId, status: "OPEN" }
          });
          if (!activeRegister) throw new Error("Nenhum caixa aberto encontrado. Abra o caixa para realizar vendas.");
          data.cashRegisterId = activeRegister.id;
        } else {
          const register = await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } });
          if (!register || register.status !== "OPEN") throw new Error("Caixa informado não está aberto.");
        }
      }

      // Travar Caixa se informado (ordem de trava: CashRegister -> ProductVariant)
      if (data.cashRegisterId) {
        await tx.$queryRawUnsafe(
          `SELECT id FROM cash_registers WHERE id = $1 FOR UPDATE`,
          data.cashRegisterId
        );
      }

      // Validar Cliente Obrigatório
      const blockNãoCustomer = !settings.allowSaleWithoutCustomer || settings.requireCustomerOnSale;
      if (blockNãoCustomer && !data.customerId) {
        throw new Error("Cliente é obrigatório para finalizar a venda.");
      }

      // Etapa 1.5: Validar Desconto
      let authorizedByUserId: string | null = null;
      let maxAllowed = 0;
      const discountPercentage = data.subtotal > 0 ? (data.discountAmount / data.subtotal) * 100 : 0;
      
      if (data.discountAmount > 0 && data.subtotal > 0) {
        const policy = await OperationalSettingsService.validateDiscountPolicy({
          companyId: data.companyId,
          userId: operatorUserId,
          discountPercent: discountPercentage,
          saleTotal: data.totalAmount
        }, tx);

        maxAllowed = policy.limitApplied;

        if (!policy.allowed) {
          if (policy.requiresAuthorization) {
            if (data.authorizationId) {
              const auth = await tx.actionAuthorization.findUnique({ where: { id: data.authorizationId } });
              if (!auth || auth.status !== 'APPROVED') {
                throw new Error('Autorização de desconto inválida ou não aprovada.');
              }
              authorizedByUserId = auth.authorizedByUserId;
            } else {
              const authReq = await authorizationService.createAuthorizationRequest({
                companyId: data.companyId,
                type: AuthorizationType.DISCOUNT,
                module: 'PDV',
                requestedByUserId: operatorUserId,
                percentage: discountPercentage,
                amount: data.discountAmount,
                reason: data.authReason || 'Desconto excede o limite',
                financialImpact: true,
              });
              
              // Interrompe o fluxo retornando a necessidade de autorização
              return { requireAuthorization: true, authorizationId: authReq.id };
            }
          } else {
            throw new Error(policy.reason || 'Desconto excede o limite máximo permitido e não pode ser autorizado.');
          }
        }
      }

      // Etapa 2: Validar estoque disponível em lote com trava pessimista
      const variantIds = [...new Set(data.items.map(item => item.variantId))].sort();
      if (variantIds.length > 0) {
        const placeholders = variantIds.map((_, idx) => `$${idx + 1}`).join(", ");
        await tx.$queryRawUnsafe(
          `SELECT id FROM product_variants WHERE id IN (${placeholders}) FOR UPDATE`,
          ...variantIds
        );
      }

      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } }
      });
      const variantMap = new Map(variants.map(v => [v.id, v]));

      for (const item of data.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) throw new Error(`Variante ${item.variantId} não encontrada.`);

        const hasNegativeStock = variant.availableStock.toNumber() < item.quantity;

        // Verificar se estoque negativo é bloqueado pelas configurações operacionais
        if (!settings.allowNegativeStock && hasNegativeStock) {
          throw new Error(`Estoque insuficiente para a variante ${variant.name}. Disponível: ${variant.availableStock.toNumber()}, Solicitado: ${item.quantity}`);
        }
      }

      // Etapa 3: Criar Sale e SaleItems e SalePayments
      const sale = await tx.sale.create({
        data: {
          companyId: data.companyId,
          sellerId: data.sellerId,
          customerId: data.customerId,
          cashRegisterId: data.cashRegisterId,
          status: "PAID",
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          globalDiscountType: data.globalDiscountType,
          globalDiscountValue: data.globalDiscountValue,
          totalAmount: data.totalAmount,
          notes: data.notes,
          customerNameSnapshot: data.customerNameSnapshot,
          customerPhoneSnapshot: data.customerPhoneSnapshot,
          items: {
            create: data.items.map(item => ({
              variantId: item.variantId,
              productNameSnapshot: item.productNameSnapshot,
              variantNameSnapshot: item.variantNameSnapshot,
              skuSnapshot: item.skuSnapshot,
              barcodeSnapshot: item.barcodeSnapshot || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountType: item.discountType,
              discountValue: item.discountValue,
              discount: item.discount,
              totalPrice: item.totalPrice,
              costPriceAtSale: item.costPriceAtSale,
              salePriceAtSale: item.salePriceAtSale,
              marginAtSale: item.marginAtSale
            }))
          },
          payments: {
            create: data.payments.map(payment => ({
              paymentMethodId: payment.paymentMethodId,
              amount: payment.amount,
              installments: payment.installments,
              status: "PAID"
            }))
          }
        },
        include: { items: true, payments: true }
      });

      // Gravar Autorização se houver
      if (authorizedByUserId) {
        await tx.saleAuthorization.create({
          data: {
            saleId: sale.id,
            requestedByUserId: data.sellerId,
            authorizedByUserId: authorizedByUserId,
            type: "DISCOUNT_OVER_LIMIT",
            status: "APPROVED",
            reason: data.authReason || "Sem motivo informado",
            requestedDiscount: data.discountAmount,
            allowedDiscount: maxAllowed
          }
        });

        await tx.activityLog.create({
          data: {
            companyId: data.companyId,
            userId: authorizedByUserId,
            action: "AUTHORIZE_DISCOUNT",
            module: "SALES",
            recordId: sale.id,
            details: `Desconto de R$ ${data.discountAmount} (Lim: ${maxAllowed}%) aprovado na venda #${sale.id}`
          }
        });
      }

      // Etapa 4: Processar Pagamentos e Financeiro
      await receivablesService.generateReceivablesFromSale(sale.id, tx);

      // Etapa 5 & 6: Criar InventoryMovement tipo SALE e atualizar ProductVariant em lote
      await tx.inventoryMovement.createMany({
        data: data.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          type: "SALE",
          userId: operatorUserId,
          reason: `Venda #${sale.id}`
        }))
      });

      for (const item of data.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            currentStock: { decrement: item.quantity },
            availableStock: { decrement: item.quantity }
          }
        });
      }

      // Etapa 7: Criar ActivityLog
      await tx.activityLog.create({
        data: {
          companyId: data.companyId,
          userId: operatorUserId,
          action: "CREATE_SALE",
          module: "SALES",
          recordId: sale.id,
          details: `Venda criada. Valor Total: ${data.totalAmount}`
        }
      });

      if (data.customerId) {
        await tx.customerHistory.create({
          data: {
            customerId: data.customerId,
            actionType: "VENDA_CONCLUIDA",
            description: `Venda #${sale.id} concluída. Valor Total: R$ ${data.totalAmount}`
          }
        });
      }

      // Etapa 8: Integrar comissões e metas
      await sellerCommissionService.processSaleCommission(tx, sale);

      return sale;
    });
  }

  async cancelSale(data: CancelSaleInput) {
    return prisma.$transaction(async (tx) => {
      // Travar a venda alvo para evitar concorrência no cancelamento
      await tx.$queryRawUnsafe(
        `SELECT id FROM sales WHERE id = $1 FOR UPDATE`,
        data.saleId
      );

      const sale = await tx.sale.findUnique({ 
        where: { id: data.saleId },
        include: { items: true } 
      });
      if (!sale) throw new Error("Venda não encontrada.");
      if (sale.status === "CANCELLED") throw new Error("Venda já está cancelada.");

      // Travar o caixa associado, se houver
      if (sale.cashRegisterId) {
        await tx.$queryRawUnsafe(
          `SELECT id FROM cash_registers WHERE id = $1 FOR UPDATE`,
          sale.cashRegisterId
        );
      }

      // Travar as variantes em ordem alfabética para o estorno de estoque
      const variantIds = [...new Set(sale.items.map(item => item.variantId))].sort();
      if (variantIds.length > 0) {
        const placeholders = variantIds.map((_, idx) => `$${idx + 1}`).join(", ");
        await tx.$queryRawUnsafe(
          `SELECT id FROM product_variants WHERE id IN (${placeholders}) FOR UPDATE`,
          ...variantIds
        );
      }

      const settings = await OperationalSettingsService.getOrCreateOperationalSettings(sale.companyId, tx);

      // Verificar se o cancelamento de venda é permitido globalmente
      if (!settings.allowSaleCancellation) {
        throw new Error("O cancelamento de vendas está desabilitado nas configurações operacionais.");
      }

      // Verificar tempo limite do cancelamento
      const diffMs = new Date().getTime() - new Date(sale.createdAt).getTime();
      const diffMin = diffMs / (1000 * 60);

      // Se ultrapassar o tempo limite e o cancelamento exige autorização, ou se exige autorização globalmente
      const isTimeLimitExceeded = diffMin > settings.cancellationTimeLimit;
      const needsAuthorization = settings.requireAuthorizationToCancelSale || isTimeLimitExceeded;

      if (needsAuthorization) {
        if (data.authorizationId) {
          const auth = await tx.actionAuthorization.findUnique({ where: { id: data.authorizationId } });
          if (!auth || auth.status !== 'APPROVED') {
            throw new Error('Autorização de cancelamento inválida ou não aprovada.');
          }
          // Here we could register the authorizer in the sale or keep it in ActionAuthorization
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: sale.companyId,
            type: AuthorizationType.SALE_CANCEL,
            module: 'VENDAS',
            requestedByUserId: data.cancelledByUserId,
            referenceId: sale.id,
            referenceModule: 'SALE',
            amount: Number(sale.totalAmount),
            reason: data.cancelReason,
            financialImpact: true,
          });
          
          return { requireAuthorization: true, authorizationId: authReq.id };
        }
      }

      // Marcar Sale como CANCELLED e preencher motivos
      const cancelledSale = await tx.sale.update({
        where: { id: data.saleId },
        data: {
          status: "CANCELLED",
          cancelReason: data.cancelReason,
          cancelledByUserId: data.cancelledByUserId,
          cancelledAt: new Date()
        }
      });

      // Estornar Contas a Receber e Saldo de Carteira / Dinheiro
      await receivablesService.cancelReceivablesFromSale(sale.id, data.cancelledByUserId, tx);

      // Criar InventoryMovement tipo CANCELLATION e devolver estoque em lote
      await tx.inventoryMovement.createMany({
        data: sale.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          type: "CANCELLATION",
          userId: data.cancelledByUserId,
          reason: `Cancelamento da Venda #${sale.id}: ${data.cancelReason}`
        }))
      });

      for (const item of sale.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            currentStock: { increment: item.quantity },
            availableStock: { increment: item.quantity }
          }
        });
      }

      // Criar ActivityLog
      await tx.activityLog.create({
        data: {
          companyId: sale.companyId,
          userId: data.cancelledByUserId,
          action: "CANCEL_SALE",
          module: "SALES",
          recordId: sale.id,
          details: `Venda cancelada. Motivo: ${data.cancelReason}`
        }
      });

      // Estornar comissões e metas
      await sellerCommissionService.rollbackSaleCommission(tx, sale);

      return cancelledSale;
    });
  }

  async getSaleById(saleId: string) {
    return prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        authorizations: true,
        commissions: true,
        customer: true,
        seller: true
      }
    });
  }

  async listSales(companyId: string, filters?: {
    sellerId?: string;
    customerId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } & PaginationParams) {
    const whereClause: any = { companyId };
    
    if (filters?.sellerId) whereClause.sellerId = filters.sellerId;
    if (filters?.customerId) whereClause.customerId = filters.customerId;
    if (filters?.status) whereClause.status = filters.status;
    
    if (filters?.startDate || filters?.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) whereClause.createdAt.gte = filters.startDate;
      if (filters.endDate) whereClause.createdAt.lte = filters.endDate;
    }

    const { skip, take, page, pageSize } = getPaginationArgs(filters);

    const [totalCount, sales] = await Promise.all([
      prisma.sale.count({ where: whereClause }),
      prisma.sale.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              variant: {
                select: {
                  name: true,
                  sku: true,
                }
              }
            }
          },
          payments: true,
          seller: { select: { name: true } },
          customer: { select: { name: true } }
        },
        skip,
        take
      })
    ]);

    return buildPaginatedResult(sales, totalCount, page, pageSize);
  }
}

export const salesService = new SalesService();
