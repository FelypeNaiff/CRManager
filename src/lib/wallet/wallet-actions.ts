'use server';
import { serializePrisma } from '@/lib/serialize';

import { requirePermission } from "@/lib/auth/permissions";
import { customerWalletService } from "./customer-wallet-service";
import { WalletTransactionType } from "@prisma/client";

export async function getWalletAction(customerId: string) {
  const session = await requirePermission("CARTEIRA", "VIEW");
  try {
    const wallet = await customerWalletService.getWallet(customerId, session.companyId);
    return { success: true, wallet };
  } catch {
    return { success: false, error: "Erro ao obter carteira." };
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
    await customerWalletService.expireCredits(customerId, session.companyId);

    const wallet = await customerWalletService.getWallet(customerId, session.companyId);
    const transactions = await customerWalletService.getWalletTransactions(customerId, session.companyId, filters);
    
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
  } catch {
    return { success: false, error: "Erro ao obter extrato da carteira." };
  }
}

export async function creditWalletAction(data: {
  customerId: string;
  amount: number;
  description: string;
  type: WalletTransactionType;
  expiresAt?: Date;
}) {
  const session = await requirePermission("CARTEIRA", "CREDIT");
  try {
    const result = await customerWalletService.creditWallet({
      ...data,
      companyId: session.companyId,
      userId: session.userId,
    });
    return { success: true, wallet: result.wallet, transaction: result.transaction };
  } catch {
    return { success: false, error: "Erro ao creditar carteira." };
  }
}

export async function debitWalletAction(data: {
  customerId: string;
  amount: number;
  description: string;
  type: WalletTransactionType;
}) {
  const session = await requirePermission("CARTEIRA", "DEBIT");
  try {
    const result = await customerWalletService.debitWallet({
      ...data,
      companyId: session.companyId,
      userId: session.userId,
    });
    return { success: true, wallet: result.wallet, transaction: result.transaction };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Saldo insuficiente na carteira do cliente.')) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro ao debitar carteira." };
  }
}

export async function createManualAdjustmentAction(data: {
  customerId: string;
  amount: number;
  type: "credit" | "debit";
  reason: string;
  authorizationId?: string;
}) {
  const session = await requirePermission("CARTEIRA", "ADJUST");

  try {
    const result = await customerWalletService.createManualAdjustment({
      ...data,
      companyId: session.companyId,
      userId: session.userId,
      authorizationId: data.authorizationId
    });
    
    if (result && 'requireAuthorization' in result) {
      return { success: false, requireAuthorization: true, authorizationId: result.authorizationId, type: data.type };
    }

    return { success: true, wallet: result.wallet };
  } catch {
    return { success: false, error: "Erro ao aplicar ajuste manual." };
  }
}
