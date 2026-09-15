import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuthorizationType } from "@prisma/client";
import { authorizationService } from "@/lib/auth/authorization-service";
import { writeLegacyActivityLog as writeActivityLog } from "@/lib/auth/activity-log";
import {
  approvedWalletAuthorizationWhere,
  walletCustomerWhere,
  walletForCustomerWhere,
} from './wallet-tenant-security';

export interface CreditWalletInput {
  customerId: string;
  amount: number | Decimal;
  description?: string;
  type: WalletTransactionType;
  saleId?: string;
  exchangeId?: string;
  returnId?: string;
  expiresAt?: Date;
  companyId: string;
  userId: string;
}

export interface DebitWalletInput {
  customerId: string;
  amount: number | Decimal;
  description?: string;
  type: WalletTransactionType;
  saleId?: string;
  exchangeId?: string;
  returnId?: string;
  companyId: string;
  userId: string;
}

export class CustomerWalletService {
  /**
   * Gets or creates a wallet for a customer.
   */
  async getWallet(customerId: string, companyId: string, tx: any = prisma) {
    const customer = await tx.customer.findFirst({
      where: walletCustomerWhere(customerId, companyId), select: { id: true },
    });
    if (!customer) throw new Error("Cliente não encontrado.");

    let wallet = await tx.customerWallet.findFirst({
      where: walletForCustomerWhere(customerId, companyId),
    });

    if (!wallet) {
      // Find customer to check companyId
      wallet = await tx.customerWallet.create({
        data: {
          customerId,
          balance: new Decimal(0.0),
        },
      });
    }

    // Se estiver rodando dentro de uma transação ativa (tx !== prisma), aplica trava pessimista
    if (tx && tx !== prisma) {
      await tx.$queryRawUnsafe(
        `SELECT cw.id FROM customer_wallets cw JOIN customers c ON c.id = cw.customer_id WHERE cw.customer_id = $1 AND c.company_id = $2 FOR UPDATE`,
        customerId,
        companyId,
      );
      // Re-busca para garantir que lemos o saldo atualizado pós-trava
      const lockedWallet = await tx.customerWallet.findFirst({
        where: walletForCustomerWhere(customerId, companyId),
      });
      if (lockedWallet) {
        wallet = lockedWallet;
      }
    }

    return wallet;
  }

  /**
   * Returns current wallet balance as a Decimal.
   */
  async getWalletBalance(customerId: string, companyId: string, tx: any = prisma): Promise<Decimal> {
    const wallet = await this.getWallet(customerId, companyId, tx);
    return wallet.balance;
  }

  /**
   * Fetches wallet transactions with optional filters.
   */
  async getWalletTransactions(
    customerId: string,
    companyId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      type?: WalletTransactionType;
      origin?: "sale" | "exchange" | "return" | "manual";
    },
    tx: any = prisma
  ) {
    const wallet = await this.getWallet(customerId, companyId, tx);

    const whereClause: any = {
      walletId: wallet.id,
    };

    if (filters?.startDate || filters?.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) whereClause.createdAt.gte = filters.startDate;
      if (filters.endDate) whereClause.createdAt.lte = filters.endDate;
    }

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    if (filters?.origin) {
      if (filters.origin === "sale") whereClause.saleId = { not: null };
      else if (filters.origin === "exchange") whereClause.exchangeId = { not: null };
      else if (filters.origin === "return") whereClause.returnId = { not: null };
      else if (filters.origin === "manual") {
        whereClause.saleId = null;
        whereClause.exchangeId = null;
        whereClause.returnId = null;
      }
    }

    return await tx.customerWalletMovement.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Credits a wallet, inserting a ledger transaction.
   */
  async creditWallet(data: CreditWalletInput, tx: any = prisma) {
    const execute = async (innerTx: any) => {
      const amountVal = new Decimal(data.amount);
      if (amountVal.lte(0)) throw new Error("O valor do crédito deve ser maior que zero.");

      const wallet = await this.getWallet(data.customerId, data.companyId, innerTx);
      const customer = await innerTx.customer.findFirst({
        where: walletCustomerWhere(data.customerId, data.companyId),
      });
      if (!customer) throw new Error("Cliente não encontrado.");

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore.add(amountVal);

      // Expiration date resolving:
      let expiresAt = data.expiresAt;
      if (!expiresAt) {
        const settings = await innerTx.operationalSettings.findFirst({
          where: { companyId: customer.companyId }
        });
        if (settings?.walletExpirationDays) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + settings.walletExpirationDays);
        }
      }

      // Update balance
      const updatedWallet = await innerTx.customerWallet.update({
        where: { id: wallet.id, customer: { companyId: data.companyId } },
        data: { balance: balanceAfter }
      });

      // Create transaction
      const transaction = await innerTx.customerWalletMovement.create({
        data: {
          walletId: wallet.id,
          type: data.type.toString(),
          amount: amountVal,
          reason: data.description || "Crédito em carteira"
        }
      });

      // Log to customer history
      await innerTx.customerHistory.create({
        data: {
          customerId: data.customerId,
          actionType: "SALDO_CREDITO",
          description: `Crédito de R$ ${amountVal.toFixed(2)} lançado. Motivo: ${data.description || "N/A"}. Novo Saldo: R$ ${balanceAfter.toFixed(2)}`,
        }
      });

      await writeActivityLog({
          companyId: data.companyId,
          userId: data.userId,
          action: "CREDITO_CARTEIRA",
          module: "CARTEIRA",
          recordId: wallet.id,
          details: `Crédito de R$ ${amountVal.toFixed(2)} gerado para cliente ${customer.name}.`,
        });

      return { wallet: updatedWallet, transaction };
    };

    if (tx === prisma) {
      return await prisma.$transaction(execute);
    } else {
      return await execute(tx);
    }
  }

  /**
   * Debits a wallet, verifying balance.
   */
  async debitWallet(data: DebitWalletInput, tx: any = prisma) {
    const execute = async (innerTx: any) => {
      const amountVal = new Decimal(data.amount);
      if (amountVal.lte(0)) throw new Error("O valor do débito deve ser maior que zero.");

      const wallet = await this.getWallet(data.customerId, data.companyId, innerTx);
      const customer = await innerTx.customer.findFirst({
        where: walletCustomerWhere(data.customerId, data.companyId),
      });
      if (!customer) throw new Error("Cliente não encontrado.");

      const balanceBefore = wallet.balance;
      if (balanceBefore.lt(amountVal)) {
        throw new Error(`Saldo insuficiente na carteira do cliente. Saldo: R$ ${balanceBefore.toFixed(2)}, Requerido: R$ ${amountVal.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore.sub(amountVal);

      // Update balance
      const updatedWallet = await innerTx.customerWallet.update({
        where: { id: wallet.id, customer: { companyId: data.companyId } },
        data: { balance: balanceAfter }
      });

      // Create transaction
      const transaction = await innerTx.customerWalletMovement.create({
        data: {
          walletId: wallet.id,
          type: data.type.toString(),
          amount: amountVal,
          reason: data.description || "Débito em carteira"
        }
      });

      // Log to customer history
      await innerTx.customerHistory.create({
        data: {
          customerId: data.customerId,
          actionType: "SALDO_DEBITO",
          description: `Débito de R$ ${amountVal.toFixed(2)} realizado. Motivo: ${data.description || "N/A"}. Novo Saldo: R$ ${balanceAfter.toFixed(2)}`,
        }
      });

      await writeActivityLog({
          companyId: data.companyId,
          userId: data.userId,
          action: "DEBITO_CARTEIRA",
          module: "CARTEIRA",
          recordId: wallet.id,
          details: `Débito de R$ ${amountVal.toFixed(2)} realizado para cliente ${customer.name}.`,
        });

      return { wallet: updatedWallet, transaction };
    };

    if (tx === prisma) {
      return await prisma.$transaction(execute);
    } else {
      return await execute(tx);
    }
  }

  async expireCredits(customerId: string, companyId: string, tx: any = prisma) {
    await this.getWallet(customerId, companyId, tx);
    // Expiration logic is disabled as CustomerWalletMovement does not support expiresAt
    return null;
  }

  /**
   * Transfers balance from one customer wallet to another.
   */
  async transferWalletBalance(
    fromCustomerId: string,
    toCustomerId: string,
    amount: number | Decimal,
    companyId: string,
    userId: string,
    tx: any = prisma
  ) {
    const amountVal = new Decimal(amount);
    if (amountVal.lte(0)) throw new Error("O valor da transferência deve ser maior que zero.");

    return await tx.$transaction(async (innerTx: any) => {
      const fromWallet = await this.getWallet(fromCustomerId, companyId, innerTx);
      const toWallet = await this.getWallet(toCustomerId, companyId, innerTx);

      const fromCustomer = await innerTx.customer.findFirst({ where: walletCustomerWhere(fromCustomerId, companyId) });
      const toCustomer = await innerTx.customer.findFirst({ where: walletCustomerWhere(toCustomerId, companyId) });
      if (!fromCustomer || !toCustomer) throw new Error('Cliente não encontrado.');

      if (fromWallet.balance.lt(amountVal)) {
        throw new Error(`Saldo insuficiente para transferir. Saldo: R$ ${fromWallet.balance.toFixed(2)}`);
      }

      // Debit source
      const debitRes = await this.debitWallet({
        customerId: fromCustomerId,
        amount: amountVal,
        type: "DEBIT",
        description: `Transferência de saldo para ${toCustomer?.name || toCustomerId}`,
        companyId,
        userId,
      }, innerTx);

      // Credit destination
      const creditRes = await this.creditWallet({
        customerId: toCustomerId,
        amount: amountVal,
        type: "CREDIT",
        description: `Transferência recebida de ${fromCustomer?.name || fromCustomerId}`,
        companyId,
        userId,
      }, innerTx);

      return { debit: debitRes, credit: creditRes };
    });
  }

  /**
   * Creates a manual adjustment check settings.
   */
  async createManualAdjustment(
    data: {
      customerId: string;
      amount: number;
      type: "credit" | "debit";
      reason: string;
      companyId: string;
      userId: string;
      authorizationId?: string;
    },
    tx: any = prisma
  ) {
    const customer = await tx.customer.findFirst({
      where: walletCustomerWhere(data.customerId, data.companyId),
    });
    if (!customer) throw new Error("Cliente não encontrado.");

    const settings = await tx.operationalSettings.findFirst({
      where: { companyId: customer.companyId }
    });

    if (data.type === "credit") {
      if (settings && !settings.walletAllowManualCredit) {
        if (data.authorizationId) {
          const auth = await tx.actionAuthorization.findFirst({
            where: approvedWalletAuthorizationWhere(data.authorizationId, data.companyId, data.customerId, 'WALLET_CREDIT'),
          });
          if (!auth) {
            throw new Error('Autorização de crédito manual inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: data.companyId,
            type: AuthorizationType.WALLET_CREDIT,
            module: 'CARTEIRA',
            requestedByUserId: data.userId,
            referenceId: customer.id,
            referenceModule: 'CUSTOMER',
            amount: data.amount,
            reason: data.reason,
            financialImpact: true,
          });
          return { requireAuthorization: true, authorizationId: authReq.id };
        }
      }
      return await this.creditWallet({
        customerId: data.customerId,
        amount: data.amount,
        type: "ADJUSTMENT",
        description: `Ajuste Manual: ${data.reason}`,
        companyId: data.companyId,
        userId: data.userId,
      }, tx);
    } else {
      if (settings && !settings.walletAllowManualDebit) {
        if (data.authorizationId) {
          const auth = await tx.actionAuthorization.findFirst({
            where: approvedWalletAuthorizationWhere(data.authorizationId, data.companyId, data.customerId, 'WALLET_DEBIT'),
          });
          if (!auth) {
            throw new Error('Autorização de débito manual inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: data.companyId,
            type: AuthorizationType.WALLET_DEBIT,
            module: 'CARTEIRA',
            requestedByUserId: data.userId,
            referenceId: customer.id,
            referenceModule: 'CUSTOMER',
            amount: data.amount,
            reason: data.reason,
            financialImpact: true,
          });
          return { requireAuthorization: true, authorizationId: authReq.id };
        }
      }
      return await this.debitWallet({
        customerId: data.customerId,
        amount: data.amount,
        type: "ADJUSTMENT",
        description: `Ajuste Manual: ${data.reason}`,
        companyId: data.companyId,
        userId: data.userId,
      }, tx);
    }
  }
}

export const customerWalletService = new CustomerWalletService();
