import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { AuthorizationType } from "@prisma/client";
import { customerWalletService } from "../wallet/customer-wallet-service";
import { authorizationService } from "../auth/authorization-service";
import { writeActivityLog } from "../auth/activity-log";

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
  async createReturn(data: CreateReturnInput) {
    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId, companyId: data.companyId },
      include: { items: true }
    });
    if (!sale) throw new Error("Venda não encontrada.");
    if (sale.status === "CANCELLED") throw new Error("Não é possível realizar devolução de uma venda cancelada.");
    if (!sale.customerId) throw new Error("Cliente não vinculado à venda original.");

    const settings = await prisma.operationalSettings.findFirst({
      where: { companyId: data.companyId }
    });

    if (settings?.returnRequireAuthorization) {
      if (data.authorizationId) {
        const auth = await prisma.actionAuthorization.findUnique({ where: { id: data.authorizationId } });
        if (!auth || auth.status !== 'APPROVED') {
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
          createdById: data.userId
        }, tx);
      }

      await writeActivityLog({
        companyId: data.companyId,
        userId: data.userId,
        action: "REALIZAR_DEVOLUCAO",
        module: "Vendas",
        recordId: returnRecord.id,
        details: `Devolução gerada para a venda ${sale.id}. Método: ${data.refundMethod}. Reembolso: R$ ${totalAmount.toFixed(2)}.`,
      });

      return returnRecord;
    });
  }

  /**
   * Retrieves a SaleReturn record.
   */
  async getReturn(id: string) {
    return await prisma.saleReturn.findUnique({
      where: { id }
    });
  }

  /**
   * Cancels a return, reverting inventory and debiting wallet (if WALLET was selected).
   */
  async cancelReturn(id: string, userId: string) {
    const returnRecord = await prisma.saleReturn.findUnique({
      where: { id }
    });
    if (!returnRecord) throw new Error("Devolução não encontrada.");
    if (returnRecord.notes?.startsWith("[CANCELADO]")) throw new Error("Esta devolução já está cancelada.");

    const sale = await prisma.sale.findUnique({
      where: { id: returnRecord.originalSaleId }
    });
    if (!sale) throw new Error("Venda de origem não encontrada.");

    return await prisma.$transaction(async (tx) => {
      // Revert wallet credit if WALLET
      if (returnRecord.refundMethod === "WALLET") {
        await customerWalletService.debitWallet({
          customerId: returnRecord.customerId,
          amount: returnRecord.totalAmount,
          type: "ADJUSTMENT",
          returnId: returnRecord.id,
          description: `Estorno de devolução cancelada #${returnRecord.id.slice(0, 8)}`,
          createdById: userId
        }, tx);
      }

      // Revert Inventory
      try {
        const parsed = JSON.parse(returnRecord.notes || "{}");
        const items = parsed.items || [];
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
      } catch (err) {
        console.error("Failed to parse items from return notes during cancellation:", err);
      }

      // Mark as cancelled
      const updatedReturn = await tx.saleReturn.update({
        where: { id },
        data: {
          notes: `[CANCELADO] ${returnRecord.notes || ""}`
        }
      });

      await writeActivityLog({
        companyId: sale.companyId,
        userId,
        action: "CANCELAR_DEVOLUCAO",
        module: "Vendas",
        recordId: returnRecord.id,
        details: `Devolução #${returnRecord.id} cancelada pelo usuário.`,
      });

      return updatedReturn;
    });
  }
}

export const returnService = new ReturnService();
