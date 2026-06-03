import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";

export class MigrationService {
  /**
   * Safe and idempotent migration of historical data.
   */
  static async migrateHistoricalData() {
    console.log("[MigrationService] Starting historical data migration...");
    
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch default/admin user for fallback createdById
      const defaultUser = await tx.user.findFirst({
        where: { status: "ACTIVE" }
      });
      const defaultUserId = defaultUser?.id || "system";

      // 2. Migrate ExchangeReturn to SaleExchange / SaleReturn
      const oldReturns = await tx.exchangeReturn.findMany();
      let exchangesCreated = 0;
      let returnsCreated = 0;

      for (const oldRet of oldReturns) {
        if (oldRet.type === "EXCHANGE") {
          // Check if already migrated
          const exists = await tx.saleExchange.findFirst({
            where: {
              originalSaleId: oldRet.originalSaleId,
              createdAt: oldRet.createdAt,
            }
          });
          if (!exists) {
            await tx.saleExchange.create({
              data: {
                originalSaleId: oldRet.originalSaleId,
                customerId: oldRet.customerId || "",
                totalAmount: oldRet.totalCredit,
                creditGenerated: oldRet.totalCredit,
                notes: oldRet.exchangeReason || "Migrado do sistema antigo",
                createdById: defaultUserId,
                financialProcessed: false,
                createdAt: oldRet.createdAt,
              }
            });
            exchangesCreated++;
          }
        } else {
          // Check if already migrated
          const exists = await tx.saleReturn.findFirst({
            where: {
              originalSaleId: oldRet.originalSaleId,
              createdAt: oldRet.createdAt,
            }
          });
          if (!exists) {
            await tx.saleReturn.create({
              data: {
                originalSaleId: oldRet.originalSaleId,
                customerId: oldRet.customerId || "",
                totalAmount: oldRet.totalCredit,
                refundMethod: "WALLET",
                notes: oldRet.exchangeReason || "Migrado do sistema antigo",
                createdById: defaultUserId,
                financialProcessed: false,
                createdAt: oldRet.createdAt,
              }
            });
            returnsCreated++;
          }
        }
      }
      console.log(`[MigrationService] Migrated ${exchangesCreated} exchanges and ${returnsCreated} returns.`);

      // 3. Migrate CustomerWalletMovements to WalletTransactions
      const wallets = await tx.customerWallet.findMany({
        include: {
          movements: {
            orderBy: { createdAt: "asc" }
          }
        }
      });

      let transactionsCreated = 0;

      for (const wallet of wallets) {
        let runningBalance = 0;

        for (const mov of wallet.movements) {
          // Check if transaction was already created for this movement ID (using movement id or mapping)
          const oldTx = await tx.walletTransaction.findFirst({
            where: {
              walletId: wallet.id,
              createdAt: mov.createdAt,
              amount: mov.amount,
              description: mov.reason
            }
          });

          // Map types
          let txType: WalletTransactionType = "ADJUSTMENT";
          const oldTypeLower = mov.type.toLowerCase();
          if (oldTypeLower.includes("credit") || oldTypeLower === "entrada") {
            txType = "CREDIT";
            if (oldTypeLower.includes("exchange")) txType = "EXCHANGE";
            if (oldTypeLower.includes("return")) txType = "REFUND";
          } else if (oldTypeLower.includes("debit") || oldTypeLower === "saida") {
            txType = "DEBIT";
          }

          const amountVal = Number(mov.amount);
          const balanceBefore = runningBalance;
          const balanceAfter = txType === "DEBIT" ? runningBalance - amountVal : runningBalance + amountVal;
          runningBalance = balanceAfter;

          if (!oldTx) {
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                customerId: wallet.customerId,
                type: txType,
                amount: mov.amount,
                balanceBefore: balanceBefore,
                balanceAfter: balanceAfter,
                description: mov.reason || "Migração de saldo histórico",
                createdById: defaultUserId,
                createdAt: mov.createdAt
              }
            });
            transactionsCreated++;
          }
        }

        // Set the final wallet balance to match our running ledger balance
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: { balance: runningBalance }
        });
      }

      console.log(`[MigrationService] Migrated ${transactionsCreated} wallet transactions.`);

      return {
        success: true,
        exchangesCreated,
        returnsCreated,
        transactionsCreated
      };
    });
  }
}
