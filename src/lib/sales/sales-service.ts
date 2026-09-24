import { AuthorizationType, Prisma } from "@prisma/client";
import { CreateSaleInput, CancelSaleInput } from "./sales-schemas";
import { sellerCommissionService } from "./seller-commission-service";
import { OperationalSettingsService } from "../configuracoes/operational-settings-service";
import { authorizationService } from "../auth/authorization-service";
import { receivablesService } from "../financial/receivables-service";
import { getPaginationArgs, buildPaginatedResult, PaginationParams } from "../performance/pagination";
import { prisma } from "@/lib/prisma";

import bcrypt from "bcryptjs";
import { tenantResourceWhere } from "./sales-tenant-security";
import { approvedAuthorizationWhere } from "../auth/authorization-security";
import { writeActivityLog } from "../auth/activity-log";
import type { ServerAuthContext } from "../auth/server-auth-context";
import { sanitizeAuditDetails } from "../auth/audit-sanitization";

const money = (value: Prisma.Decimal.Value) =>
  new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

function finiteDecimal(value: Prisma.Decimal.Value, field: string) {
  let parsed: Prisma.Decimal;
  try {
    parsed = new Prisma.Decimal(value);
  } catch {
    throw new Error(`${field} inválido.`);
  }
  if (!parsed.isFinite()) throw new Error(`${field} inválido.`);
  return parsed;
}

export class SalesService {
  constructor(
    private readonly db: any = prisma,
    private readonly dependencies = {
      operationalSettings: OperationalSettingsService,
      authorization: authorizationService,
      receivables: receivablesService,
      sellerCommission: sellerCommissionService,
    },
  ) {}

  async createSale(data: CreateSaleInput, operatorUserId: string, auditContext: ServerAuthContext) {
    return this.db.$transaction(async (tx: any) => {
      if (auditContext.companyId !== data.companyId || auditContext.userId !== operatorUserId) {
        throw new Error('Contexto de identidade inválido para a venda.');
      }
      // Etapa 1: Validar empresa, vendedor, cliente, caixa
      const company = await tx.company.findUnique({ where: { id: data.companyId } });
      if (!company) throw new Error("Empresa inválida.");

      const seller = await tx.seller.findFirst({
        where: { ...tenantResourceWhere(data.sellerId, data.companyId), status: "ACTIVE" }
      });
      if (!seller) throw new Error("Vendedor inválido.");

      if (data.customerId) {
        const customer = await tx.customer.findFirst({
          where: tenantResourceWhere(data.customerId, data.companyId)
        });
        if (!customer) throw new Error("Cliente inválido.");
      }

      const paymentMethodIds = [...new Set(data.payments.map(payment => payment.paymentMethodId))];
      const paymentMethods = await tx.paymentMethod.findMany({
        where: { id: { in: paymentMethodIds }, companyId: data.companyId, isActive: true },
        select: {
          id: true,
          type: true,
          allowsInstallments: true,
          settlementDays: true,
        },
      });
      if (paymentMethods.length !== paymentMethodIds.length) {
        throw new Error("Forma de pagamento inválida.");
      }

      // Carregar configurações operacionais da empresa
      const settings = await this.dependencies.operationalSettings.getOrCreateOperationalSettings(data.companyId, tx);

      const hasCashPayment = paymentMethods.some((method: any) => method.type === 'CASH');
      let cashRegisterId = data.cashRegisterId;
      if (cashRegisterId) {
        const register = await tx.cashRegister.findFirst({
          where: { ...tenantResourceWhere(cashRegisterId, data.companyId), status: 'OPEN' },
          select: { id: true },
        });
        if (!register) throw new Error("Caixa informado não está aberto.");
      } else if (hasCashPayment || settings.requireOpenCashRegister) {
        const activeRegister = await tx.cashRegister.findFirst({
          where: { companyId: data.companyId, status: "OPEN" },
          select: { id: true },
          orderBy: { openedAt: 'desc' },
        });
        cashRegisterId = activeRegister?.id;
        if (!cashRegisterId) {
          const reason = hasCashPayment
            ? "Venda em dinheiro requer um caixa aberto."
            : "Nenhum caixa aberto encontrado. Abra o caixa para realizar vendas.";
          throw new Error(reason);
        }
      }

      // Travar Caixa se informado (ordem de trava: CashRegister -> ProductVariant)
      if (cashRegisterId) {
        await tx.$queryRawUnsafe(
          `SELECT id FROM cash_registers WHERE id = $1 AND company_id = $2 FOR UPDATE`,
          cashRegisterId,
          data.companyId
        );
      }

      // Validar Cliente Obrigatório
      const blockNãoCustomer = !settings.allowSaleWithoutCustomer || settings.requireCustomerOnSale;
      if (blockNãoCustomer && !data.customerId) {
        throw new Error("Cliente é obrigatório para finalizar a venda.");
      }

      // Etapa 2: Validar estoque disponível em lote com trava pessimista
      const variantIds = [...new Set(data.items.map(item => item.variantId))].sort();
      if (variantIds.length > 0) {
        const placeholders = variantIds.map((_, idx) => `$${idx + 2}`).join(", ");
        await tx.$queryRawUnsafe(
          `SELECT id FROM product_variants WHERE company_id = $1 AND id IN (${placeholders}) FOR UPDATE`,
          data.companyId,
          ...variantIds
        );
      }

      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: variantIds },
          companyId: data.companyId,
          isActive: true,
          archivedAt: null,
          product: { is: { companyId: data.companyId, isActive: true, archivedAt: null } },
        },
        include: { product: { select: { name: true } } },
      });
      const variantMap = new Map<string, any>(variants.map((v: any) => [v.id, v]));

      let canonicalSubtotal = money(0);
      let canonicalItemDiscount = money(0);
      const canonicalItems = data.items.map(item => {
        const variant = variantMap.get(item.variantId);
        if (!variant) throw new Error(`Variante ${item.variantId} não encontrada.`);

        const quantity = finiteDecimal(item.quantity, 'Quantidade');
        if (quantity.lte(0)) throw new Error('Quantidade inválida.');

        const unitPrice = money(variant.salePrice);
        const costPrice = money(variant.costPrice);
        const discountIntent = finiteDecimal(item.discountValue ?? item.discount ?? 0, 'Desconto do item');
        if (discountIntent.lt(0)) throw new Error('Desconto do item não pode ser negativo.');

        let unitDiscount: Prisma.Decimal;
        if (item.discountType === 'PERCENTAGE') {
          if (discountIntent.gt(100)) throw new Error('Percentual de desconto do item inválido.');
          unitDiscount = money(unitPrice.mul(discountIntent).div(100));
        } else {
          unitDiscount = money(discountIntent);
        }
        if (unitDiscount.gt(unitPrice)) throw new Error('Desconto do item não pode superar o preço unitário.');

        const lineSubtotal = money(unitPrice.mul(quantity));
        const lineDiscount = money(unitDiscount.mul(quantity));
        const lineTotal = money(lineSubtotal.minus(lineDiscount));
        if (lineTotal.lt(0)) throw new Error('Total líquido do item inválido.');

        canonicalSubtotal = money(canonicalSubtotal.plus(lineSubtotal));
        canonicalItemDiscount = money(canonicalItemDiscount.plus(lineDiscount));
        const margin = unitPrice.eq(0)
          ? money(0)
          : unitPrice.minus(costPrice).div(unitPrice).mul(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        return {
          variantId: variant.id,
          productNameSnapshot: variant.product.name,
          variantNameSnapshot: variant.name,
          skuSnapshot: variant.sku,
          barcodeSnapshot: variant.barcode || null,
          quantity,
          unitPrice,
          discountType: item.discountType ?? 'AMOUNT',
          discountValue: discountIntent,
          discount: unitDiscount,
          totalPrice: lineTotal,
          costPriceAtSale: costPrice,
          salePriceAtSale: unitPrice,
          marginAtSale: margin,
        };
      });

      for (const item of data.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) throw new Error(`Variante ${item.variantId} não encontrada.`);

        const hasNegativeStock = variant.availableStock.toNumber() < item.quantity;

        // Verificar se estoque negativo é bloqueado pelas configurações operacionais
        if (!settings.allowNegativeStock && hasNegativeStock) {
          throw new Error(`Estoque insuficiente para a variante ${variant.name}. Disponível: ${variant.availableStock.toNumber()}, Solicitado: ${item.quantity}`);
        }
      }

      const subtotalAfterItems = money(canonicalSubtotal.minus(canonicalItemDiscount));
      const globalDiscountIntent = finiteDecimal(data.globalDiscountValue ?? 0, 'Desconto global');
      if (globalDiscountIntent.lt(0)) throw new Error('Desconto global não pode ser negativo.');
      let canonicalGlobalDiscount: Prisma.Decimal;
      if (data.globalDiscountType === 'PERCENTAGE') {
        if (globalDiscountIntent.gt(100)) throw new Error('Percentual de desconto global inválido.');
        canonicalGlobalDiscount = money(subtotalAfterItems.mul(globalDiscountIntent).div(100));
      } else {
        canonicalGlobalDiscount = money(globalDiscountIntent);
      }
      if (canonicalGlobalDiscount.gt(subtotalAfterItems)) {
        throw new Error('Desconto global não pode superar o subtotal após descontos dos itens.');
      }

      const canonicalDiscountAmount = money(canonicalItemDiscount.plus(canonicalGlobalDiscount));
      const canonicalTotal = money(canonicalSubtotal.minus(canonicalDiscountAmount));
      if (canonicalTotal.lt(0)) throw new Error('Total da venda inválido.');

      const paymentMethodMap = new Map<string, any>(
        paymentMethods.map((method: any) => [method.id, method]),
      );
      const canonicalPayments = data.payments.map(payment => {
        const paymentMethod = paymentMethodMap.get(payment.paymentMethodId);
        if (!paymentMethod) throw new Error('Forma de pagamento inválida.');
        if (!Number.isInteger(payment.installments) || payment.installments < 1) {
          throw new Error('Quantidade de parcelas inválida.');
        }
        if (payment.installments > 1 && !paymentMethod.allowsInstallments) {
          throw new Error('Forma de pagamento não permite parcelamento.');
        }
        const amount = finiteDecimal(payment.amount, 'Valor do pagamento');
        if (amount.lte(0) || amount.decimalPlaces() > 2) throw new Error('Valor do pagamento inválido.');
        const immediateSettlement = paymentMethod.type === 'CASH'
          || paymentMethod.type === 'CUSTOMER_WALLET'
          || paymentMethod.type === 'PIX'
          || (paymentMethod.settlementDays === 0 && payment.installments === 1);
        return {
          ...payment,
          amount: money(amount),
          status: immediateSettlement ? 'PAID' : 'PENDING',
        };
      });
      const paymentTotal = money(canonicalPayments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      ));
      if (!paymentTotal.eq(canonicalTotal)) {
        throw new Error('A soma dos pagamentos deve ser igual ao total da venda.');
      }

      // Etapa 2.5: validar a política sobre os valores recalculados pelo servidor.
      let authorizedByUserId: string | null = null;
      let maxAllowed = 0;
      const discountPercentage = canonicalSubtotal.gt(0)
        ? canonicalDiscountAmount.div(canonicalSubtotal).mul(100).toNumber()
        : 0;

      if (canonicalDiscountAmount.gt(0) && canonicalSubtotal.gt(0)) {
        const policy = await this.dependencies.operationalSettings.validateDiscountPolicy({
          companyId: data.companyId,
          userId: operatorUserId,
          discountPercent: discountPercentage,
          saleTotal: canonicalTotal.toNumber(),
        }, tx);
        maxAllowed = policy.limitApplied;
        if (!policy.allowed) {
          if (!policy.requiresAuthorization) {
            throw new Error(policy.reason || 'Desconto excede o limite máximo permitido e não pode ser autorizado.');
          }
          if (data.authorizationId) {
            const auth = await tx.actionAuthorization.findFirst({
              where: approvedAuthorizationWhere({
                id: data.authorizationId,
                companyId: data.companyId,
                type: AuthorizationType.DISCOUNT,
                module: 'PDV',
              }),
            });
            if (!auth) throw new Error('Autorização de desconto inválida ou não aprovada.');
            authorizedByUserId = auth.authorizedByUserId;
          } else {
            const authReq = await this.dependencies.authorization.createAuthorizationRequest({
              companyId: data.companyId,
              type: AuthorizationType.DISCOUNT,
              module: 'PDV',
              requestedByUserId: operatorUserId,
              percentage: discountPercentage,
              amount: canonicalDiscountAmount.toNumber(),
              reason: data.authReason || 'Desconto excede o limite',
              metadata: { requesterLimit: maxAllowed },
              financialImpact: true,
            });
            return { requireAuthorization: true, authorizationId: authReq.id };
          }
        }
      }

      // Etapa 3: Criar Sale e SaleItems e SalePayments
      const sale = await tx.sale.create({
        data: {
          companyId: data.companyId,
          sellerId: data.sellerId,
          customerId: data.customerId,
          cashRegisterId,
          status: "PAID",
          subtotal: canonicalSubtotal,
          discountAmount: canonicalDiscountAmount,
          globalDiscountType: data.globalDiscountType,
          globalDiscountValue: data.globalDiscountValue,
          totalAmount: canonicalTotal,
          notes: data.notes,
          customerNameSnapshot: data.customerNameSnapshot,
          customerPhoneSnapshot: data.customerPhoneSnapshot,
          items: {
            create: canonicalItems,
          },
          payments: {
            create: canonicalPayments.map(payment => ({
              paymentMethodId: payment.paymentMethodId,
              amount: payment.amount,
              installments: payment.installments,
              status: payment.status,
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
            requestedByUserId: operatorUserId,
            authorizedByUserId: authorizedByUserId,
            type: "DISCOUNT_OVER_LIMIT",
            status: "APPROVED",
            reason: data.authReason || "Sem motivo informado",
            requestedDiscount: canonicalDiscountAmount,
            allowedDiscount: maxAllowed
          }
        });

      }

      // Etapa 4: Processar Pagamentos e Financeiro
      await this.dependencies.receivables.generateReceivablesFromSale(sale.id, {
        actorUserId: auditContext.userId,
        authenticatedUserId: auditContext.authenticatedUserId,
      }, tx);

      // Etapa 5 & 6: Criar InventoryMovement tipo SALE e atualizar ProductVariant em lote
      await tx.inventoryMovement.createMany({
        data: data.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          type: "SALE",
          userId: auditContext.userId,
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

      if (auditContext) {
        for (const [index, item] of canonicalItems.entries()) {
          if (Number(item.discount) <= 0) continue;
          await writeActivityLog({
            context: auditContext,
            action: 'SALE_ITEM_DISCOUNT_APPLY',
            module: 'DISCOUNTS',
            recordId: sale.items[index]?.id ?? sale.id,
            details: 'Desconto aplicado a item da venda.',
            metadata: {
              saleId: sale.id,
              variantId: item.variantId,
              type: item.discountType ?? 'AMOUNT',
              requested: Number(item.discountValue ?? item.discount),
              discountAmount: Number(item.discount),
            },
          }, { policy: 'CRITICAL', tx });
        }
        if (canonicalGlobalDiscount.gt(0)) {
          await writeActivityLog({
            context: auditContext,
            action: 'SALE_GLOBAL_DISCOUNT_APPLY',
            module: 'DISCOUNTS',
            recordId: sale.id,
            details: 'Desconto global aplicado à venda.',
            metadata: {
              type: data.globalDiscountType ?? 'AMOUNT',
              requested: Number(data.globalDiscountValue ?? 0),
              discountAmount: canonicalGlobalDiscount.toNumber(),
            },
          }, { policy: 'CRITICAL', tx });
        }
        await writeActivityLog({
          context: auditContext,
          action: 'SALE_CREATE',
          module: 'SALES',
          recordId: sale.id,
          details: 'Venda registrada.',
          metadata: {
            sellerId: sale.sellerId,
            customerId: sale.customerId,
            itemCount: sale.items.length,
            subtotal: Number(sale.subtotal),
            discountAmount: Number(sale.discountAmount),
            total: Number(sale.totalAmount),
            paymentMethodIds: [...new Set(canonicalPayments.map(payment => payment.paymentMethodId))],
            status: sale.status,
          },
        }, { policy: 'CRITICAL', tx });
      }

      if (data.customerId) {
        await tx.customerHistory.create({
          data: {
            customerId: data.customerId,
            actionType: "VENDA_CONCLUIDA",
            description: `Venda #${sale.id} concluída. Valor Total: R$ ${canonicalTotal.toFixed(2)}`
          }
        });
      }

      // Etapa 8: Integrar comissões e metas
      await this.dependencies.sellerCommission.processSaleCommission(tx, sale);

      return sale;
    });
  }

  async cancelSale(data: CancelSaleInput, companyId: string, auditContext?: ServerAuthContext) {
    return this.db.$transaction(async (tx: any) => {
      // Travar a venda alvo para evitar concorrência no cancelamento
      await tx.$queryRawUnsafe(
        `SELECT id FROM sales WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        data.saleId,
        companyId
      );

      const sale = await tx.sale.findFirst({
        where: tenantResourceWhere(data.saleId, companyId),
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
      const variantIds = [...new Set<string>(sale.items.map((item: any) => item.variantId))].sort();
      if (variantIds.length > 0) {
        const placeholders = variantIds.map((_, idx) => `$${idx + 1}`).join(", ");
        await tx.$queryRawUnsafe(
          `SELECT id FROM product_variants WHERE id IN (${placeholders}) FOR UPDATE`,
          ...variantIds
        );
      }

      const settings = await this.dependencies.operationalSettings.getOrCreateOperationalSettings(sale.companyId, tx);

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
          const auth = await tx.actionAuthorization.findFirst({
            where: approvedAuthorizationWhere({
              id: data.authorizationId,
              companyId,
              type: AuthorizationType.SALE_CANCEL,
              module: 'VENDAS',
              referenceId: sale.id,
              referenceModule: 'SALE',
            })
          });
          if (!auth) {
            throw new Error('Autorização de cancelamento inválida ou não aprovada.');
          }
          // Here we could register the authorizer in the sale or keep it in ActionAuthorization
        } else {
          const authReq = await this.dependencies.authorization.createAuthorizationRequest({
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
        where: { id: data.saleId, companyId },
        data: {
          status: "CANCELLED",
          cancelReason: data.cancelReason,
          cancelledByUserId: data.cancelledByUserId,
          cancelledAt: new Date()
        }
      });

      // Estornar Contas a Receber e Saldo de Carteira / Dinheiro
      await this.dependencies.receivables.cancelReceivablesFromSale(
        sale.id,
        data.cancelledByUserId,
        companyId,
        tx,
      );

      // Criar InventoryMovement tipo CANCELLATION e devolver estoque em lote
      await tx.inventoryMovement.createMany({
        data: sale.items.map((item: any) => ({
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

      if (auditContext) await writeActivityLog({
        context: auditContext,
        action: 'SALE_CANCEL',
        module: 'SALES',
        recordId: sale.id,
        details: 'Venda cancelada.',
        metadata: {
          status: { before: sale.status, after: 'CANCELLED' },
          reason: sanitizeAuditDetails(data.cancelReason),
          cancelledAmount: Number(sale.totalAmount),
          cancelledByUserId: auditContext.userId,
        },
      }, { policy: 'CRITICAL', tx });

      // Estornar comissões e metas
      await this.dependencies.sellerCommission.rollbackSaleCommission(tx, sale);

      return cancelledSale;
    });
  }

  async getSaleById(saleId: string, companyId: string) {
    return this.db.sale.findFirst({
      where: tenantResourceWhere(saleId, companyId),
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
      this.db.sale.count({ where: whereClause }),
      this.db.sale.findMany({
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
