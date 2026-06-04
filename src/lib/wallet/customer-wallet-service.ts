import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuthorizationType } from "@prisma/client";
import { authorizationService } from "@/lib/auth/authorization-service";
import { writeActivityLog } from "@/lib/auth/activity-log";

export interface CreditWalletInput {
  customerId: string;
  amount: number | Decimal;
  description?: string;
  type: WalletTransactionType;
  saleId?: string;
  exchangeId?: string;
  returnId?: string;
  createdById?: string;
  expiresAt?: Date;
}

export interface DebitWalletInput {
  customerId: string;
  amount: number | Decimal;
  description?: string;
  type: WalletTransactionType;
  saleId?: string;
  exchangeId?: string;
  returnId?: string;
  createdById?: string;
}

export class CustomerWalletService {
  /**
   * Gets or creates a wallet for a customer.
   */
  async getWallet(customerId: string, tx: any = prisma) {
    let wallet = await tx.customerWallet.findUnique({
      where: { customerId },
    });

    if (!wallet) {
      // Find customer to check companyId
      const customer = await tx.customer.findUnique({
        where: { id: customerId }
      });
      if (!customer) throw new Error("Cliente não encontrado.");

      wallet = await tx.customerWallet.create({
        data: {
          customerId,
          balance: new Decimal(0.0),
        },
      });
    }

    return wallet;
  }

  /**
   * Returns current wallet balance as a Decimal.
   */
  async getWalletBalance(customerId: string, tx: any = prisma): Promise<Decimal> {
    const wallet = await this.getWallet(customerId, tx);
    return wallet.balance;
  }

  /**
   * Fetches wallet transactions with optional filters.
   */
  async getWalletTransactions(
    customerId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      type?: WalletTransactionType;
      origin?: "sale" | "exchange" | "return" | "manual";
    },
    tx: any = prisma
  ) {
    const wallet = await this.getWallet(customerId, tx);

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
    const amountVal = new Decimal(data.amount);
    if (amountVal.lte(0)) throw new Error("O valor do crédito deve ser maior que zero.");

    const wallet = await this.getWallet(data.customerId, tx);
    const customer = await tx.customer.findUnique({
      where: { id: data.customerId }
    });
    if (!customer) throw new Error("Cliente não encontrado.");

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore.add(amountVal);

    // Expiration date resolving:
    let expiresAt = data.expiresAt;
    if (!expiresAt) {
      const settings = await tx.operationalSettings.findFirst({
        where: { companyId: customer.companyId }
      });
      if (settings?.walletExpirationDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + settings.walletExpirationDays);
      }
    }

    // Update balance
    const updatedWallet = await tx.customerWallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter }
    });

    // Create transaction
    const transaction = await tx.customerWalletMovement.create({
      data: {
        walletId: wallet.id,
        type: data.type.toString(),
        amount: amountVal,
        reason: data.description || "Crédito em carteira"
      }
    });

    // Log to customer history
    await tx.customerHistory.create({
      data: {
        customerId: data.customerId,
        actionType: "SALDO_CREDITO",
        description: `Crédito de R$ ${amountVal.toFixed(2)} lançado. Motivo: ${data.description || "N/A"}. Novo Saldo: R$ ${balanceAfter.toFixed(2)}`,
      }
    });

    if (data.createdById) {
      await writeActivityLog({
        companyId: customer.companyId,
        userId: data.createdById,
        action: "CREDITO_CARTEIRA",
        module: "CARTEIRA",
        recordId: wallet.id,
        details: `Crédito de R$ ${amountVal.toFixed(2)} gerado para cliente ${customer.name}.`,
      });
    }

    return { wallet: updatedWallet, transaction };
  }

  /**
   * Debits a wallet, verifying balance.
   */
  async debitWallet(data: DebitWalletInput, tx: any = prisma) {
    const amountVal = new Decimal(data.amount);
    if (amountVal.lte(0)) throw new Error("O valor do débito deve ser maior que zero.");

    const wallet = await this.getWallet(data.customerId, tx);
    const customer = await tx.customer.findUnique({
      where: { id: data.customerId }
    });
    if (!customer) throw new Error("Cliente não encontrado.");

    const balanceBefore = wallet.balance;
    if (balanceBefore.lt(amountVal)) {
      throw new Error(`Saldo insuficiente na carteira do cliente. Saldo: R$ ${balanceBefore.toFixed(2)}, Requerido: R$ ${amountVal.toFixed(2)}`);
    }

    const balanceAfter = balanceBefore.sub(amountVal);

    // Update balance
    const updatedWallet = await tx.customerWallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter }
    });

    // Create transaction
    const transaction = await tx.customerWalletMovement.create({
      data: {
        walletId: wallet.id,
        type: data.type.toString(),
        amount: amountVal,
        reason: data.description || "Débito em carteira"
      }
    });

    // Log to customer history
    await tx.customerHistory.create({
      data: {
        customerId: data.customerId,
        actionType: "SALDO_DEBITO",
        description: `Débito de R$ ${amountVal.toFixed(2)} realizado. Motivo: ${data.description || "N/A"}. Novo Saldo: R$ ${balanceAfter.toFixed(2)}`,
      }
    });

    if (data.createdById) {
      await writeActivityLog({
        companyId: customer.companyId,
        userId: data.createdById,
        action: "DEBITO_CARTEIRA",
        module: "CARTEIRA",
        recordId: wallet.id,
        details: `Débito de R$ ${amountVal.toFixed(2)} realizado para cliente ${customer.name}.`,
      });
    }

    return { wallet: updatedWallet, transaction };
  }

  async expireCredits(customerId: string, tx: any = prisma) {
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
    createdById?: string,
    tx: any = prisma
  ) {
    const amountVal = new Decimal(amount);
    if (amountVal.lte(0)) throw new Error("O valor da transferência deve ser maior que zero.");

    return await tx.$transaction(async (innerTx: any) => {
      const fromWallet = await this.getWallet(fromCustomerId, innerTx);
      const toWallet = await this.getWallet(toCustomerId, innerTx);

      const fromCustomer = await innerTx.customer.findUnique({ where: { id: fromCustomerId } });
      const toCustomer = await innerTx.customer.findUnique({ where: { id: toCustomerId } });

      if (fromWallet.balance.lt(amountVal)) {
        throw new Error(`Saldo insuficiente para transferir. Saldo: R$ ${fromWallet.balance.toFixed(2)}`);
      }

      // Debit source
      const debitRes = await this.debitWallet({
        customerId: fromCustomerId,
        amount: amountVal,
        type: "DEBIT",
        description: `Transferência de saldo para ${toCustomer?.name || toCustomerId}`,
        createdById
      }, innerTx);

      // Credit destination
      const creditRes = await this.creditWallet({
        customerId: toCustomerId,
        amount: amountVal,
        type: "CREDIT",
        description: `Transferência recebida de ${fromCustomer?.name || fromCustomerId}`,
        createdById
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
      createdById: string;
      authorizationId?: string;
    },
    tx: any = prisma
  ) {
    const customer = await tx.customer.findUnique({
      where: { id: data.customerId }
    });
    if (!customer) throw new Error("Cliente não encontrado.");

    const settings = await tx.operationalSettings.findFirst({
      where: { companyId: customer.companyId }
    });

    if (data.type === "credit") {
      if (settings && !settings.walletAllowManualCredit) {
        if (data.authorizationId) {
          const auth = await tx.actionAuthorization.findUnique({ where: { id: data.authorizationId } });
          if (!auth || auth.status !== 'APPROVED') {
            throw new Error('Autorização de crédito manual inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: customer.companyId,
            type: AuthorizationType.WALLET_CREDIT,
            module: 'CARTEIRA',
            requestedByUserId: data.createdById,
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
        createdById: data.createdById
      }, tx);
    } else {
      if (settings && !settings.walletAllowManualDebit) {
        if (data.authorizationId) {
          const auth = await tx.actionAuthorization.findUnique({ where: { id: data.authorizationId } });
          if (!auth || auth.status !== 'APPROVED') {
            throw new Error('Autorização de débito manual inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: customer.companyId,
            type: AuthorizationType.WALLET_DEBIT,
            module: 'CARTEIRA',
            requestedByUserId: data.createdById,
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
        createdById: data.createdById
      }, tx);
    }
  }
}

export const customerWalletService = new CustomerWalletService();
