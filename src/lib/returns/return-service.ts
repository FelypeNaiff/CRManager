import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { AuthorizationType } from "@prisma/client";
import { customerWalletService } from "../wallet/customer-wallet-service";
import { authorizationService } from "../auth/authorization-service";
import { writeActivityLog } from "../auth/activity-log";
import type { ServerAuthContext } from "../auth/server-auth-context";
import { sanitizeAuditDetails } from "../auth/audit-sanitization";
import { itemBelongsToSale, tenantResourceWhere } from "../exchanges/exchange-return-tenant-security";
import { approvedAuthorizationWhere } from "../auth/authorization-security";

export interface CreateReturnInput {
  companyId: string;
  userId: string;
  saleId: string;
  refundMethod: "WALLET" | "CASH" | "PIX";
  reason?: string;
  items: {
    variantId: string;
    quantity: number;
    condition: "RESALE" | "DAMAGED" | "DISCARD";
  }[];
  authorizationId?: string;
}

export class ReturnService {
  /**
   * Creates a new SaleReturn, updates inventory, and credits the wallet if WALLET is chosen.
   */
  async createReturn(data: CreateReturnInput, auditContext?: ServerAuthContext) {
    const sale = await prisma.sale.findFirst({
      where: tenantResourceWhere(data.saleId, data.companyId),
      include: { items: true }
    });
    if (!sale) throw new Error("Venda não encontrada.");
    if (sale.status === "CANCELLED") throw new Error("Não é possível realizar devolução de uma venda cancelada.");
    if (!sale.customerId) throw new Error("Cliente não vinculado à venda original.");

    const customer = await prisma.customer.findFirst({
      where: tenantResourceWhere(sale.customerId, data.companyId)
    });
    if (!customer) throw new Error("Cliente inválido.");

    const variantIds = [...new Set(data.items.map(item => item.variantId))];
    const tenantVariants = await prisma.productVariant.count({
      where: { id: { in: variantIds }, companyId: data.companyId }
    });
    if (tenantVariants !== variantIds.length) throw new Error("Item inválido.");

    const settings = await prisma.operationalSettings.findFirst({
      where: { companyId: data.companyId }
    });

    if (settings?.returnRequireAuthorization) {
      if (data.authorizationId) {
        const auth = await prisma.actionAuthorization.findFirst({
          where: approvedAuthorizationWhere({
            id: data.authorizationId,
            companyId: data.companyId,
            type: AuthorizationType.RETURN,
            module: 'DEVOLUCOES',
            referenceId: sale.id,
            referenceModule: 'SALE',
          })
        });
        if (!auth) {
          throw new Error('Autorização inválida ou não aprovada.');
        }
      } else {
        const authReq = await authorizationService.createAuthorizationRequest({
          companyId: data.companyId,
          type: AuthorizationType.RETURN,
          module: 'DEVOLUCOES',
          requestedByUserId: data.userId,
          referenceId: sale.id,
          referenceModule: 'SALE',
          reason: data.reason || 'Devolução de itens',
          financialImpact: true,
        });
        
        return { requireAuthorization: true, authorizationId: authReq.id };
      }
    }

    return await prisma.$transaction(async (tx) => {
      let totalAmount = new Decimal(0);

      // Verify limits
      const existingExchanges = await tx.saleExchange.findMany({
        where: { originalSaleId: sale.id }
      });
      const existingReturns = await tx.saleReturn.findMany({
        where: { originalSaleId: sale.id }
      });

      const returnedQuantities = new Map<string, number>();

      const parseItems = (notes: string | null) => {
        if (!notes) return [];
        try {
          const parsed = JSON.parse(notes);
          return parsed.items || [];
        } catch {
          return [];
        }
      };

      for (const ex of existingExchanges) {
        if (ex.notes?.startsWith("[CANCELADO]")) continue;
        const items = parseItems(ex.notes);
        for (const item of items) {
          const prev = returnedQuantities.get(item.variantId) || 0;
          returnedQuantities.set(item.variantId, prev + Number(item.quantity));
        }
      }

      for (const ret of existingReturns) {
        if (ret.notes?.startsWith("[CANCELADO]")) continue;
        const items = parseItems(ret.notes);
        for (const item of items) {
          const prev = returnedQuantities.get(item.variantId) || 0;
          returnedQuantities.set(item.variantId, prev + Number(item.quantity));
        }
      }

      for (const itemInput of data.items) {
        const saleItem = sale.items.find(i => i.variantId === itemInput.variantId);
        if (!saleItem) {
          throw new Error(`Produto (variante ${itemInput.variantId}) não pertence a esta venda.`);
        }

        const alreadyReturned = returnedQuantities.get(itemInput.variantId) || 0;
        const availableToReturn = Number(saleItem.quantity) - alreadyReturned;

        if (itemInput.quantity > availableToReturn) {
          throw new Error(
            `Quantidade solicitada (${itemInput.quantity}) excede a quantidade disponível para devolução (${availableToReturn}) para a variante ${itemInput.variantId}.`
          );
        }

        const proportion = itemInput.quantity / Number(saleItem.quantity);
        const itemReturnedValue = new Decimal(saleItem.totalPrice).mul(proportion);
        totalAmount = totalAmount.add(itemReturnedValue);

        // Stock Update
        let invType: "RETURN" | "DAMAGE" | "LOSS" = "RETURN";
        let incrementAvailable = false;

        if (itemInput.condition === "RESALE") {
          invType = "RETURN";
          incrementAvailable = true;
        } else if (itemInput.condition === "DAMAGED") {
          invType = "DAMAGE";
        } else if (itemInput.condition === "DISCARD") {
          invType = "LOSS";
        }

        if (incrementAvailable) {
          await tx.productVariant.update({
            where: { id: itemInput.variantId },
            data: {
              currentStock: { increment: itemInput.quantity },
              availableStock: { increment: itemInput.quantity }
            }
          });
        }

        await tx.inventoryMovement.create({
          data: {
            variantId: itemInput.variantId,
            userId: data.userId,
            type: invType,
            quantity: itemInput.quantity,
            reason: `Devolução da Venda ${sale.id}`
          }
        });
      }

      const notesJson = JSON.stringify({
        reason: data.reason || "",
        items: data.items
      });

      // Create SaleReturn
      const returnRecord = await tx.saleReturn.create({
        data: {
          originalSaleId: data.saleId,
          customerId: sale.customerId!,
          totalAmount,
          refundMethod: data.refundMethod,
          notes: notesJson,
          createdById: data.userId,
          financialProcessed: false
        }
      });

      // If method is WALLET, credit customer wallet
      if (data.refundMethod === "WALLET") {
        await customerWalletService.creditWallet({
          customerId: sale.customerId!,
          amount: totalAmount,
          type: "REFUND",
          returnId: returnRecord.id,
          description: `Crédito de reembolso por Devolução da Venda #${sale.id.slice(0, 8)}`,
          companyId: data.companyId,
          userId: data.userId,
        }, tx);
      }

      if (auditContext) await writeActivityLog({
        context: auditContext,
        action: "RETURN_CREATE",
        module: "RETURNS",
        recordId: returnRecord.id,
        details: 'Devolução registrada.',
        metadata: {
          originalSaleId: sale.id,
          returnedItems: data.items.map(item => ({ variantId: item.variantId, quantity: item.quantity, condition: item.condition })),
          refundAmount: Number(totalAmount),
          walletCredit: data.refundMethod === 'WALLET' ? Number(totalAmount) : 0,
          refundMethod: data.refundMethod,
          stockAdjustment: data.items.map(item => ({ variantId: item.variantId, quantity: item.quantity, condition: item.condition })),
          status: 'ACTIVE',
          reason: sanitizeAuditDetails(data.reason),
        },
      }, { policy: 'CRITICAL', tx });

      return returnRecord;
    });
  }

  /**
   * Retrieves a SaleReturn record.
   */
  async getReturn(id: string, companyId: string) {
    const returnRecord = await prisma.saleReturn.findUnique({ where: { id } });
    if (!returnRecord) return null;
    const sale = await prisma.sale.findFirst({
      where: tenantResourceWhere(returnRecord.originalSaleId, companyId),
      select: { id: true }
    });
    return sale ? returnRecord : null;
  }

  /**
   * Cancels a return, reverting inventory and debiting wallet (if WALLET was selected).
   */
  async cancelReturn(id: string, companyId: string, userId: string, auditContext?: ServerAuthContext) {
    const returnRecord = await prisma.saleReturn.findUnique({
      where: { id }
    });
    if (!returnRecord) throw new Error("Devolução não encontrada.");
    if (returnRecord.notes?.startsWith("[CANCELADO]")) throw new Error("Esta devolução já está cancelada.");

    const sale = await prisma.sale.findFirst({
      where: tenantResourceWhere(returnRecord.originalSaleId, companyId),
      include: { items: true }
    });
    if (!sale) throw new Error("Venda de origem não encontrada.");
    if (returnRecord.customerId !== sale.customerId) throw new Error("Devolução não encontrada.");
    const customer = await prisma.customer.findFirst({
      where: tenantResourceWhere(returnRecord.customerId, companyId),
      select: { id: true }
    });
    if (!customer) throw new Error("Devolução não encontrada.");

    let items: Array<{ variantId: string; quantity: number; condition: string }>;
    try {
      const parsed = JSON.parse(returnRecord.notes || "{}");
      items = Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      throw new Error("Devolução inválida.");
    }
    if (items.some(item => !itemBelongsToSale(sale.items, item.variantId))) {
      throw new Error("Devolução inválida.");
    }
    const variantIds = [...new Set(items.map(item => item.variantId))];
    const validVariants = await prisma.productVariant.count({
      where: { id: { in: variantIds }, companyId }
    });
    if (validVariants !== variantIds.length) throw new Error("Devolução inválida.");

    return await prisma.$transaction(async (tx) => {
      // Revert wallet credit if WALLET
      if (returnRecord.refundMethod === "WALLET") {
        await customerWalletService.debitWallet({
          customerId: returnRecord.customerId,
          amount: returnRecord.totalAmount,
          type: "ADJUSTMENT",
          returnId: returnRecord.id,
          description: `Estorno de devolução cancelada #${returnRecord.id.slice(0, 8)}`,
          companyId,
          userId,
        }, tx);
      }

      // Revert Inventory
      for (const item of items) {
          if (item.condition === "RESALE") {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                currentStock: { decrement: item.quantity },
                availableStock: { decrement: item.quantity }
              }
            });
          }

          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              userId,
              type: "CANCELLATION",
              quantity: item.quantity,
              reason: `Estorno de Devolução Cancelada ${returnRecord.id}`
            }
          });
      }

      // Mark as cancelled
      const updatedReturn = await tx.saleReturn.update({
        where: { id },
        data: {
          notes: `[CANCELADO] ${returnRecord.notes || ""}`
        }
      });

      if (auditContext) await writeActivityLog({
        context: auditContext,
        action: "RETURN_CANCEL",
        module: "RETURNS",
        recordId: returnRecord.id,
        details: 'Devolução cancelada.',
        metadata: {
          originalSaleId: sale.id,
          status: { before: 'ACTIVE', after: 'CANCELLED' },
          refundAmount: Number(returnRecord.totalAmount),
          walletCreditReverted: returnRecord.refundMethod === 'WALLET' ? Number(returnRecord.totalAmount) : 0,
          stockAdjustment: items.map(item => ({ variantId: item.variantId, quantity: item.quantity, condition: item.condition })),
        },
      }, { policy: 'CRITICAL', tx });

      return updatedReturn;
    });
  }
}

export const returnService = new ReturnService();
