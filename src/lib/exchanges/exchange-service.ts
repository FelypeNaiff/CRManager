import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { AuthorizationType } from "@prisma/client";
import { customerWalletService } from "../wallet/customer-wallet-service";
import { authorizationService } from "../auth/authorization-service";
import { writeActivityLog } from "../auth/activity-log";

export interface CreateExchangeInput {
  companyId: string;
  userId: string;
  saleId: string;
  reason?: string;
  items: {
    variantId: string;
    quantity: number;
    condition: "RESALE" | "DAMAGED" | "DISCARD";
  }[];
  authorizationId?: string;
}

export class ExchangeService {
  /**
   * Creates a new SaleExchange, performs inventory changes, and credits the customer's wallet.
   */
  async createExchange(data: CreateExchangeInput) {
    // 1. Check if authorization is required
    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId, companyId: data.companyId },
      include: { items: true }
    });
    if (!sale) throw new Error("Venda não encontrada.");
    if (sale.status === "CANCELLED") throw new Error("Não é possível realizar troca de uma venda cancelada.");
    if (!sale.customerId) throw new Error("Cliente não vinculado à venda original.");

    const settings = await prisma.operationalSettings.findFirst({
      where: { companyId: data.companyId }
    });

    if (settings?.exchangeRequireAuthorization) {
      if (data.authorizationId) {
        const auth = await prisma.actionAuthorization.findUnique({ where: { id: data.authorizationId } });
        if (!auth || auth.status !== 'APPROVED') {
          throw new Error('Autorização inválida ou não aprovada.');
        }
      } else {
        const authReq = await authorizationService.createAuthorizationRequest({
          companyId: data.companyId,
          type: AuthorizationType.EXCHANGE,
          module: 'TROCAS',
          requestedByUserId: data.userId,
          referenceId: sale.id,
          referenceModule: 'SALE',
          reason: data.reason || 'Troca de itens',
          financialImpact: true,
        });
        
        return { requireAuthorization: true, authorizationId: authReq.id };
      }
    }

    return await prisma.$transaction(async (tx) => {
      // Calculate credit generated and compile items
      let creditGenerated = new Decimal(0);
      
      // Calculate previous returns/exchanges to avoid exceeding quantities
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
            `Quantidade solicitada (${itemInput.quantity}) excede a quantidade disponível para troca (${availableToReturn}) para a variante ${itemInput.variantId}.`
          );
        }

        const proportion = itemInput.quantity / Number(saleItem.quantity);
        const itemReturnedValue = new Decimal(saleItem.totalPrice).mul(proportion);
        creditGenerated = creditGenerated.add(itemReturnedValue);

        // Revert Stock
        let invType: "EXCHANGE" | "DAMAGE" | "LOSS" = "EXCHANGE";
        let incrementAvailable = false;

        if (itemInput.condition === "RESALE") {
          invType = "EXCHANGE";
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
            reason: `Troca da Venda ${sale.id}`
          }
        });
      }

      // Store items in notes JSON
      const notesJson = JSON.stringify({
        reason: data.reason || "",
        items: data.items
      });

      // Create SaleExchange
      const exchange = await tx.saleExchange.create({
        data: {
          originalSaleId: data.saleId,
          customerId: sale.customerId!,
          totalAmount: creditGenerated,
          creditGenerated,
          notes: notesJson,
          createdById: data.userId,
          financialProcessed: false
        }
      });

      // Credit Customer Wallet
      await customerWalletService.creditWallet({
        customerId: sale.customerId!,
        amount: creditGenerated,
        type: "EXCHANGE",
        exchangeId: exchange.id,
        description: `Crédito gerado por Troca da Venda #${sale.id.slice(0, 8)}`,
        createdById: data.userId
      }, tx);

      // Register activity log for audit
      await writeActivityLog({
        companyId: data.companyId,
        userId: data.userId,
        action: "REALIZAR_TROCA",
        module: "Vendas",
        recordId: exchange.id,
        details: `Troca gerada para a venda ${sale.id}. Crédito: R$ ${creditGenerated.toFixed(2)}.`,
      });

      return exchange;
    });
  }

  /**
   * Retrieves a SaleExchange record.
   */
  async getExchange(id: string) {
    return await prisma.saleExchange.findUnique({
      where: { id }
    });
  }

  /**
   * Cancels an exchange, reverting inventory and debiting the wallet.
   */
  async cancelExchange(id: string, userId: string) {
    const exchange = await prisma.saleExchange.findUnique({
      where: { id }
    });
    if (!exchange) throw new Error("Troca não encontrada.");
    if (exchange.notes?.startsWith("[CANCELADO]")) throw new Error("Esta troca já está cancelada.");

    // Fetch original sale to get companyId
    const sale = await prisma.sale.findUnique({
      where: { id: exchange.originalSaleId }
    });
    if (!sale) throw new Error("Venda de origem não encontrada.");

    return await prisma.$transaction(async (tx) => {
      // Revert credit by debiting wallet
      await customerWalletService.debitWallet({
        customerId: exchange.customerId,
        amount: exchange.creditGenerated,
        type: "ADJUSTMENT",
        exchangeId: exchange.id,
        description: `Estorno de troca cancelada #${exchange.id.slice(0, 8)}`,
        createdById: userId
      }, tx);

      // Revert Inventory
      try {
        const parsed = JSON.parse(exchange.notes || "{}");
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
              reason: `Estorno de Troca Cancelada ${exchange.id}`
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse items from exchange notes during cancellation:", err);
      }

      // Mark exchange as cancelled
      const updatedExchange = await tx.saleExchange.update({
        where: { id },
        data: {
          notes: `[CANCELADO] ${exchange.notes || ""}`
        }
      });

      await writeActivityLog({
        companyId: sale.companyId,
        userId,
        action: "CANCELAR_TROCA",
        module: "Vendas",
        recordId: exchange.id,
        details: `Troca #${exchange.id} cancelada pelo usuário.`,
      });

      return updatedExchange;
    });
  }
}

export const exchangeService = new ExchangeService();
