'use server';
import { serializePrisma } from '@/lib/serialize';

import { requirePermission } from "@/lib/auth/permissions";
import { customerWalletService } from "./customer-wallet-service";
import { WalletTransactionType } from "@prisma/client";

export async function getWalletAction(customerId: string) {
  const session = await requirePermission("CARTEIRA", "VIEW");
  try {
    const wallet = await customerWalletService.getWallet(customerId);
    return { success: true, wallet };
  } catch (error: any) {
    console.error("Error in getWalletAction:", error);
    return { success: false, error: error.message || "Erro ao obter carteira." };
  }
}

export async function getCustomerWalletAction(customerId: string, filters?: {
  startDate?: Date;
  endDate?: Date;
  type?: WalletTransactionType;
  origin?: "sale" | "exchange" | "return" | "manual";
}) {
  const session = await requirePermission("CARTEIRA", "VIEW");
  try {
    // Check and trigger any expired credits first
    await customerWalletService.expireCredits(customerId);

    const wallet = await customerWalletService.getWallet(customerId);
    const transactions = await customerWalletService.getWalletTransactions(customerId, filters);
    
    // Calculate total credits and debits for display
    let totalCredits = 0;
    let totalDebits = 0;
    
    for (const tx of transactions) {
      const amt = Number(tx.amount);
      if (tx.type === "DEBIT" || tx.type === "EXPIRATION") {
        totalDebits += amt;
      } else {
        totalCredits += amt;
      }
    }

    return {
      success: true,
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance),
        customerId: wallet.customerId
      },
      transactions: transactions.map((t: any) => ({
        id: t.id,
        walletId: t.walletId,
        type: t.type,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
        description: t.description,
        saleId: t.saleId,
        exchangeId: t.exchangeId,
        returnId: t.returnId,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt
      })),
      totalCredits,
      totalDebits
    };
  } catch (error: any) {
    console.error("Error in getCustomerWalletAction:", error);
    return { success: false, error: error.message || "Erro ao obter extrato da carteira." };
  }
}

export async function creditWalletAction(data: {
  customerId: string;
  amount: number;
  description: string;
  type: WalletTransactionType;
  expiresAt?: Date;
}) {
  const session = await requirePermission("CARTEIRA", "CREATE");
  try {
    const result = await customerWalletService.creditWallet({
      ...data,
      createdById: session.userId
    });
    return { success: true, wallet: result.wallet, transaction: result.transaction };
  } catch (error: any) {
    console.error("Error in creditWalletAction:", error);
    return { success: false, error: error.message || "Erro ao creditar carteira." };
  }
}

export async function debitWalletAction(data: {
  customerId: string;
  amount: number;
  description: string;
  type: WalletTransactionType;
}) {
  const session = await requirePermission("CARTEIRA", "DELETE"); // matching DEBIT
  try {
    const result = await customerWalletService.debitWallet({
      ...data,
      createdById: session.userId
    });
    return { success: true, wallet: result.wallet, transaction: result.transaction };
  } catch (error: any) {
    console.error("Error in debitWalletAction:", error);
    return { success: false, error: error.message || "Erro ao debitar carteira." };
  }
}

export async function createManualAdjustmentAction(data: {
  customerId: string;
  amount: number;
  type: "credit" | "debit";
  reason: string;
  authorizationId?: string;
}) {
  const session = await requirePermission("CARTEIRA", "UPDATE"); // matching ADJUST
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    action: "WALLET_ADJUSTMENT_REQUEST",
    customerId: data.customerId,
    amount: data.amount,
    type: data.type,
    userId: session.userId
  }));

  try {
    const result = await customerWalletService.createManualAdjustment({
      ...data,
      createdById: session.userId,
      authorizationId: data.authorizationId
    });
    
    if (result && 'requireAuthorization' in result) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        action: "WALLET_ADJUSTMENT_REQUIRES_AUTH",
        authorizationId: result.authorizationId
      }));
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId, type: data.type };
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      action: "WALLET_ADJUSTMENT_SUCCESS",
      customerId: data.customerId,
      amount: data.amount,
      type: data.type
    }));

    return { success: true, wallet: result.wallet };
  } catch (error: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      action: "WALLET_ADJUSTMENT_FAILURE",
      customerId: data.customerId,
      error: error.message || "Erro ao aplicar ajuste manual."
    }));
    return { success: false, error: error.message || "Erro ao aplicar ajuste manual." };
  }
}
