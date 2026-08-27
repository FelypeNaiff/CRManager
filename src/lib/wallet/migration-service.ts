import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";
import { assertTenantMigrationLinks, tenantMigrationWhere } from './wallet-migration-security';

export class MigrationService {
  /**
   * Safe and idempotent migration of historical data.
   */
  static async getTenantCounts(companyId: string, db: any = prisma): Promise<[number, number, number, number, number]> {
    const scope = tenantMigrationWhere(companyId);
    const tenantSales = await db.sale.findMany({ where: { companyId }, select: { id: true } });
    const saleIds = tenantSales.map((sale: { id: string }) => sale.id);
    return Promise.all([
      db.exchangeReturn.count({ where: scope.legacyReturns }),
      db.customerWalletMovement.count({ where: scope.walletRecords }),
      db.saleExchange.count({ where: { originalSaleId: { in: saleIds } } }),
      db.saleReturn.count({ where: { originalSaleId: { in: saleIds } } }),
      db.walletTransaction.count({ where: scope.walletRecords }),
    ]);
  }

  static async migrateHistoricalData(companyId: string, actorUserId: string, db: any = prisma) {
    return db.$transaction(async (tx: any) => {
      const scope = tenantMigrationWhere(companyId);
      const actor = await tx.user.findFirst({ where: scope.actor(actorUserId), select: { id: true } });
      if (!actor) throw new Error('Executor da migração inválido para a empresa autenticada.');

      // 2. Migrate ExchangeReturn to SaleExchange / SaleReturn
      const oldReturns = await tx.exchangeReturn.findMany({ where: scope.legacyReturns });
      const legacySaleIds = [...new Set(oldReturns.map((record: any) => record.originalSaleId))] as string[];
      const legacyCustomerIds = [...new Set(oldReturns.map((record: any) => record.customerId).filter(Boolean))] as string[];
      const [tenantSales, tenantCustomers] = await Promise.all([
        tx.sale.findMany({ where: { id: { in: legacySaleIds }, companyId }, select: { id: true } }),
        tx.customer.findMany({ where: { id: { in: legacyCustomerIds }, companyId }, select: { id: true } }),
      ]);
      assertTenantMigrationLinks({
        legacySaleIds,
        tenantSaleIds: tenantSales.map((record: any) => record.id),
        legacyCustomerIds,
        tenantCustomerIds: tenantCustomers.map((record: any) => record.id),
      });
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
                createdById: actor.id,
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
                createdById: actor.id,
                financialProcessed: false,
                createdAt: oldRet.createdAt,
              }
            });
            returnsCreated++;
          }
        }
      }
      // 3. Migrate CustomerWalletMovements to WalletTransactions
      const wallets = await tx.customerWallet.findMany({
        where: scope.wallets,
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
                createdById: actor.id,
                createdAt: mov.createdAt
              }
            });
            transactionsCreated++;
          }
        }

        // Set the final wallet balance to match our running ledger balance
        const update = await tx.customerWallet.updateMany({
          where: { id: wallet.id, customer: { companyId } },
          data: { balance: runningBalance }
        });
        if (update.count !== 1) throw new Error('Carteira fora do escopo da empresa autenticada.');
      }

      return {
        success: true,
        exchangesCreated,
        returnsCreated,
        transactionsCreated
      };
    });
  }
}
