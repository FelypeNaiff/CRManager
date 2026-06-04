import { PrismaClient, AuthorizationType } from "@prisma/client";
import { CreateSaleInput, CancelSaleInput } from "./sales-schemas";
import { sellerCommissionService } from "./seller-commission-service";
import { OperationalSettingsService } from "../configuracoes/operational-settings-service";
import { authorizationService } from "../auth/authorization-service";
import { receivablesService } from "../financial/receivables-service";
import { getPaginationArgs, buildPaginatedResult, PaginationParams } from "../performance/pagination";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export class SalesService {
  async createSale(data: CreateSaleInput) {
    return prisma.$transaction(async (tx) => {
      // Etapa 1: Validar empresa, vendedor, cliente, caixa
      const company = await tx.company.findUnique({ where: { id: data.companyId } });
      if (!company) throw new Error("Empresa inválida.");

      const seller = await tx.user.findUnique({ where: { id: data.sellerId }, include: { role: true } });
      if (!seller || !seller.isSeller) throw new Error("Vendedor inválido.");

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

      // Validar Cliente Obrigatório
      const blockNoCustomer = !settings.allowSaleWithoutCustomer || settings.requireCustomerOnSale;
      if (blockNoCustomer && !data.customerId) {
        throw new Error("Cliente é obrigatório para finalizar a venda.");
      }

      // Etapa 1.5: Validar Desconto (Fase 6F e Sprint CONFIG-03)
      let authorizedByUserId: string | null = null;
      let maxAllowed = 0;
      const discountPercentage = data.subtotal > 0 ? (data.discountAmount / data.subtotal) * 100 : 0;
      
      if (data.discountAmount > 0 && data.subtotal > 0) {
        const policy = await OperationalSettingsService.validateDiscountPolicy({
          companyId: data.companyId,
          userId: data.sellerId,
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
                requestedByUserId: data.sellerId,
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

      // Etapa 2: Validar estoque disponível
      for (const item of data.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
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
              barcodeSnapshot: item.barcodeSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
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

      // Etapa 5 & 6: Criar InventoryMovement tipo SALE e atualizar ProductVariant
      for (const item of data.items) {
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "SALE",
            userId: data.sellerId,
            reason: `Venda #${sale.id}`
          }
        });

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
          userId: data.sellerId,
          action: "CREATE_SALE",
          module: "SALES",
          recordId: sale.id,
          details: `Venda criada. Valor Total: ${data.totalAmount}`
        }
      });

      // Etapa 8: Integrar comissões e metas
      await sellerCommissionService.processSaleCommission(tx, sale);

      return sale;
    });
  }

  async cancelSale(data: CancelSaleInput) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ 
        where: { id: data.saleId },
        include: { items: true } 
      });
      if (!sale) throw new Error("Venda não encontrada.");
      if (sale.status === "CANCELLED") throw new Error("Venda já está cancelada.");

      const settings = await OperationalSettingsService.getOrCreateOperationalSettings(sale.companyId, tx);

      // Verificar se o cancelamento de venda é permitido globalmente
      if (!settings.allowSaleCancellation) {
        throw new Error("O cancelamento de vendas está desabilitado nas configurações operacionais.");
      }

      // Verificar tempo limite do cancelamento
      const diffMs = new Date().getTime() - new Date(sale.createdAt).getTime();
      const diffMin = diffMs / (1000 * 60);

      // Se ultrapassar o tempo limite e o cancelamento exige autorização, ou se exige autorização globalmente
      const canceller = await tx.user.findUnique({
        where: { id: data.cancelledByUserId },
        include: { role: { include: { permissions: true } } }
      });

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

      // Criar InventoryMovement tipo CANCELLATION e devolver estoque
      for (const item of sale.items) {
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "CANCELLATION",
            userId: data.cancelledByUserId,
            reason: `Cancelamento da Venda #${sale.id}: ${data.cancelReason}`
          }
        });

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
