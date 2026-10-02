import { prisma } from "@/lib/prisma";
import { ExchangeReturnType, ExchangeReturnCondition, InventoryMovementType } from "@prisma/client";
import { sellerGoalForSaleWhere } from "./sales-tenant-security";
import { writeActivityLog } from "../auth/activity-log";
import type { ServerAuthContext } from "../auth/server-auth-context";
import { sanitizeAuditDetails } from "../auth/audit-sanitization";
import { applyInventoryMovement, getOrCreateDefaultWarehouse } from "../inventory/inventory-service";

interface ExchangeReturnItemInput {
  variantId: string;
  quantity: number;
  condition: ExchangeReturnCondition;
}

export interface ProcessExchangeReturnInput {
  companyId: string;
  saleId: string;
  userId: string;
  type: ExchangeReturnType;
  reason?: string;
  items: ExchangeReturnItemInput[];
}

export class ExchangeService {
  constructor(private readonly db: any = prisma, private readonly inventory: any = { applyInventoryMovement, getOrCreateDefaultWarehouse }) {}

  async processExchangeReturn(data: ProcessExchangeReturnInput, auditContext?: ServerAuthContext) {
    return await this.db.$transaction(async (tx: any) => {
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, companyId: data.companyId },
        include: { items: true, commissions: true, customer: true }
      }) as any;

      if (!sale) throw new Error("Venda não encontrada.");
      if (sale.status === "CANCELLED") throw new Error("Venda já está cancelada.");
      if (!sale.customerId) throw new Error("Não é possível gerar crédito sem um cliente vinculado à venda.");

      const customer = await tx.customer.findFirst({
        where: { id: sale.customerId, companyId: data.companyId }
      });
      if (!customer) throw new Error("Cliente inválido.");

      const variantIds = [...new Set(data.items.map(item => item.variantId))];
      const validVariants = await tx.productVariant.count({
        where: { id: { in: variantIds }, companyId: data.companyId }
      });
      if (validVariants !== variantIds.length) throw new Error("Item inválido.");

      let totalCredit = 0;
      let totalReturnedItems = 0;
      let totalOriginalItems = sale.items.reduce((acc: number, i: { quantity: { toNumber(): number } }) => acc + i.quantity.toNumber(), 0);

      // Verify previously returned quantities
      const existingReturns = await tx.exchangeReturn.findMany({
        where: { originalSaleId: sale.id },
        include: { items: true }
      });

      const returnedQuantities = new Map<string, number>();
      for (const er of existingReturns) {
        for (const item of er.items) {
          const prev = returnedQuantities.get(item.variantId) || 0;
          returnedQuantities.set(item.variantId, prev + item.quantity.toNumber());
        }
      }
      
      for (const itemInput of data.items) {
        const saleItem = sale.items.find((i: { variantId: string }) => i.variantId === itemInput.variantId);
        if (!saleItem) throw new Error(`Produto não encontrado na venda (variante ${itemInput.variantId})`);

        const alreadyReturned = returnedQuantities.get(itemInput.variantId) || 0;
        const availableToReturn = saleItem.quantity.toNumber() - alreadyReturned;

        if (itemInput.quantity > availableToReturn) {
          throw new Error(`Quantidade solicitada (${itemInput.quantity}) excede disponível para devolução (${availableToReturn}) para variante ${itemInput.variantId}`);
        }

        const proportion = itemInput.quantity / saleItem.quantity.toNumber();
        const returnedValue = saleItem.totalPrice.toNumber() * proportion;
        totalCredit += returnedValue;
        totalReturnedItems += itemInput.quantity;

        // Stock Updates
        let invType: InventoryMovementType = "RETURN";
        let incrementAvailable = false;

        if (itemInput.condition === "RESALE") {
          invType = "RETURN";
          incrementAvailable = true;
        } else if (itemInput.condition === "DAMAGED") {
          invType = "DAMAGE";
        } else if (itemInput.condition === "DISCARD") {
          invType = "LOSS";
        }

        if (!auditContext) throw new Error('Contexto autenticado é obrigatório para registrar retorno.');
        const warehouse = await this.inventory.getOrCreateDefaultWarehouse(tx, data.companyId);
        await this.inventory.applyInventoryMovement(tx, auditContext, {
          warehouseId: warehouse.id,
          variantId: itemInput.variantId,
          physicalDelta: incrementAvailable ? itemInput.quantity : 0,
          type: invType,
          origin: data.type === 'RETURN' ? 'EXCHANGE_RETURN' : 'EXCHANGE',
          documentType: 'SALE',
          documentId: sale.id,
          idempotencyKey: `exchange-return:${sale.id}:${existingReturns.length}:${itemInput.variantId}:${itemInput.condition}`,
          reason: `Devolução/Troca da Venda ${sale.id}`,
        });
      }

      // Wallet Credit
      let wallet = await tx.customerWallet.findUnique({ where: { customerId: sale.customerId } });
      if (!wallet) {
        wallet = await tx.customerWallet.create({
          data: { customerId: sale.customerId, balance: 0 }
        });
      }

      await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: totalCredit } }
      });

      const movementType = data.type === "RETURN" ? "RETURN_CREDIT" : "EXCHANGE_CREDIT";
      await tx.customerWalletMovement.create({
        data: {
          walletId: wallet.id,
          amount: totalCredit,
          type: movementType,
          reason: data.reason
        }
      });

      // Commissions and Goals
      const commission = sale.commissions?.[0];
      if (commission && commission.status !== "CANCELLED") {
        const commProportion = totalCredit / sale.totalAmount.toNumber();
        const reducedAmount = commission.amount.toNumber() * commProportion;
        
        // Count total returns including this one
        const totalReturnsAfterThis = Array.from(returnedQuantities.values()).reduce((a, b) => a + b, 0) + totalReturnedItems;
        const isTotalReturn = totalReturnsAfterThis >= totalOriginalItems;

        if (isTotalReturn) {
          await tx.sellerCommission.update({
            where: { id: commission.id },
            data: { status: "CANCELLED" }
          });
        } else {
          await tx.sellerCommission.update({
            where: { id: commission.id },
            data: { amount: { decrement: reducedAmount } }
          });
        }
      }

      const now = new Date();
      const activeGoal = await tx.sellerGoal.findFirst({
        where: sellerGoalForSaleWhere(sale.sellerId, data.companyId, now)
      });

      if (activeGoal) {
        await tx.sellerGoal.update({
          where: { id: activeGoal.id },
          data: { achievedAmount: { decrement: totalCredit } }
        });
      }

      // Update Sale Status
      const totalReturnsAfterThis = Array.from(returnedQuantities.values()).reduce((a, b) => a + b, 0) + totalReturnedItems;
      const isTotalReturn = totalReturnsAfterThis >= totalOriginalItems;
      const newStatus = isTotalReturn ? "RETURNED" : "PARTIALLY_RETURNED";

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus }
      });

      // Create ExchangeReturn and Items
      const er = await tx.exchangeReturn.create({
        data: {
          companyId: data.companyId,
          originalSaleId: sale.id,
          customerId: sale.customerId,
          type: data.type,
          totalCredit,
          exchangeReason: data.reason,
          status: "COMPLETED",
          items: {
            create: data.items.map(i => ({
              variantId: i.variantId,
              quantity: i.quantity,
              condition: i.condition
            }))
          }
        }
      });

      if (auditContext) await writeActivityLog({
        context: auditContext,
        action: data.type === 'RETURN' ? 'RETURN_CREATE' : 'EXCHANGE_CREATE',
        module: data.type === 'RETURN' ? 'RETURNS' : 'EXCHANGES',
        recordId: er.id,
        details: data.type === 'RETURN' ? 'Devolução comercial registrada.' : 'Troca comercial registrada.',
        metadata: {
          originalSaleId: sale.id,
          returnedItems: data.items.map(item => ({ variantId: item.variantId, quantity: item.quantity, condition: item.condition })),
          newItems: [],
          financialDifference: Number(totalCredit),
          creditGenerated: Number(totalCredit),
          stockAdjustment: data.items.map(item => ({ variantId: item.variantId, quantity: item.quantity, condition: item.condition })),
          saleStatus: { before: sale.status, after: newStatus },
          status: er.status,
          reason: sanitizeAuditDetails(data.reason),
        },
      }, { policy: 'CRITICAL', tx });

      return { success: true, exchangeReturn: er, totalCredit };
    });
  }
}
