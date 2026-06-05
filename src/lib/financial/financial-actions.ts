'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { Prisma } from '@prisma/client';
import {
  BankAccountSchema,
  CostCenterSchema,
  FinancialAccountSchema,
  PaymentMethodSchema,
  FinancialTransactionSchema,
} from './financial-schemas';

// =============================================================================
// BANK ACCOUNTS — Contas Bancárias
// =============================================================================

export async function getBankAccounts() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(accounts) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getBankAccountById(id: string) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const account = await prisma.bankAccount.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!account) return { success: false, error: 'Conta não encontrada.' };
    return { success: true, data: serializePrisma(account) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createBankAccount(input: any) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');
  const parsed = BankAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const account = await prisma.$transaction(async (tx) => {
      const newAccount = await tx.bankAccount.create({
        data: {
          companyId: session.companyId,
          name: parsed.data.name,
          bankName: parsed.data.bankName,
          accountNumber: parsed.data.accountNumber,
          agency: parsed.data.agency,
          pixKey: parsed.data.pixKey,
          initialBalance: new Prisma.Decimal(parsed.data.initialBalance ?? 0),
          currentBalance: new Prisma.Decimal(parsed.data.initialBalance ?? 0),
          isCashAccount: parsed.data.isCashAccount ?? false,
        },
      });
      return newAccount;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'FINANCEIRO',
      recordId: account.id,
      details: `Conta bancária "${account.name}" criada com saldo inicial de R$ ${account.initialBalance}.`,
    });

    return { success: true, data: serializePrisma(account) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBankAccount(id: string, input: any) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  const parsed = BankAccountSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const account = await prisma.bankAccount.updateMany({
      where: { id, companyId: session.companyId },
      data: parsed.data,
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EDITAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Conta bancária "${parsed.data.name ?? id}" atualizada.`,
    });

    return { success: true, data: serializePrisma(account) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteBankAccount(id: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');
  try {
    await prisma.bankAccount.updateMany({
      where: { id, companyId: session.companyId },
      data: { isActive: false, archivedAt: new Date() },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EXCLUIR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Conta bancária ${id} inativada (soft delete).`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// COST CENTERS — Centros de Custo
// =============================================================================

export async function getCostCenters() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const centers = await prisma.costCenter.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(centers) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCostCenter(input: any) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');
  const parsed = CostCenterSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const center = await prisma.costCenter.create({
      data: { companyId: session.companyId, ...parsed.data },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'FINANCEIRO',
      recordId: center.id,
      details: `Centro de custo "${center.name}" criado.`,
    });

    return { success: true, data: serializePrisma(center) };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Já existe um centro de custo com este nome.' };
    return { success: false, error: error.message };
  }
}

export async function updateCostCenter(id: string, input: any) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  const parsed = CostCenterSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    await prisma.costCenter.updateMany({
      where: { id, companyId: session.companyId },
      data: parsed.data,
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EDITAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Centro de custo ${id} atualizado.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCostCenter(id: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');
  try {
    await prisma.costCenter.updateMany({
      where: { id, companyId: session.companyId },
      data: { isActive: false, archivedAt: new Date() },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EXCLUIR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Centro de custo ${id} inativado.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// FINANCIAL ACCOUNTS — Plano de Contas
// =============================================================================

export async function getFinancialAccounts() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const accounts = await prisma.financialAccount.findMany({
      where: { companyId: session.companyId, isActive: true },
      include: { children: { where: { isActive: true } } },
      orderBy: { code: 'asc' },
    });
    return { success: true, data: serializePrisma(accounts) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createFinancialAccount(input: any) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');
  const parsed = FinancialAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const account = await prisma.financialAccount.create({
      data: { companyId: session.companyId, ...parsed.data },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'FINANCEIRO',
      recordId: account.id,
      details: `Conta contábil "${account.code} — ${account.name}" criada no plano de contas.`,
    });

    return { success: true, data: serializePrisma(account) };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Já existe uma conta com este código.' };
    return { success: false, error: error.message };
  }
}

export async function updateFinancialAccount(id: string, input: any) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  const parsed = FinancialAccountSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    await prisma.financialAccount.updateMany({
      where: { id, companyId: session.companyId },
      data: parsed.data,
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EDITAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Conta contábil ${id} atualizada no plano de contas.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// PAYMENT METHODS — Formas de Pagamento
// =============================================================================

export async function getPaymentMethods() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }],
    });
    return { success: true, data: serializePrisma(methods) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createPaymentMethod(input: any) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');
  const parsed = PaymentMethodSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const method = await prisma.paymentMethod.create({
      data: {
        companyId: session.companyId,
        ...parsed.data,
        feePercentage: new Prisma.Decimal(parsed.data.feePercentage ?? 0),
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'FINANCEIRO',
      recordId: method.id,
      details: `Forma de pagamento "${method.name}" (${method.type}) criada.`,
    });

    return { success: true, data: serializePrisma(method) };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Já existe uma forma de pagamento com este nome.' };
    return { success: false, error: error.message };
  }
}

export async function updatePaymentMethod(id: string, input: any) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  const parsed = PaymentMethodSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const data: any = { ...parsed.data };
    if (parsed.data.feePercentage !== undefined) {
      data.feePercentage = new Prisma.Decimal(parsed.data.feePercentage);
    }

    await prisma.paymentMethod.updateMany({
      where: { id, companyId: session.companyId },
      data,
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EDITAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Forma de pagamento ${id} atualizada.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePaymentMethod(id: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');
  try {
    const method = await prisma.paymentMethod.findFirst({ where: { id, companyId: session.companyId } });
    if (method?.isSystemDefault) return { success: false, error: 'Formas de pagamento padrão do sistema não podem ser excluídas.' };

    await prisma.paymentMethod.updateMany({
      where: { id, companyId: session.companyId },
      data: { isActive: false, archivedAt: new Date() },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EXCLUIR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Forma de pagamento ${id} inativada.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// FINANCIAL TRANSACTIONS — Transações Financeiras
// =============================================================================

export async function createFinancialTransaction(input: any) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');
  const parsed = FinancialTransactionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const newTx = await tx.financialTransaction.create({
        data: {
          companyId: session.companyId,
          createdByUserId: session.userId,
          type: parsed.data.type as any,
          direction: parsed.data.direction,
          status: 'PAID',
          bankAccountId: parsed.data.bankAccountId || null,
          cashRegisterId: parsed.data.cashRegisterId || null,
          paymentMethodId: parsed.data.paymentMethodId || null,
          costCenterId: parsed.data.costCenterId || null,
          financialAccountId: parsed.data.financialAccountId || null,
          customerId: parsed.data.customerId || null,
          referenceType: parsed.data.referenceType || null,
          referenceId: parsed.data.referenceId || null,
          sourceModule: parsed.data.sourceModule || 'Manual',
          externalReference: parsed.data.externalReference || null,
          description: parsed.data.description,
          amount: new Prisma.Decimal(parsed.data.amount),
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
        },
      });

      // Atualizar saldo da conta bancária
      if (parsed.data.bankAccountId) {
        const delta = parsed.data.direction === 'IN' ? parsed.data.amount : -parsed.data.amount;
        await tx.bankAccount.update({
          where: { id: parsed.data.bankAccountId },
          data: { currentBalance: { increment: new Prisma.Decimal(delta) } },
        });
      }

      return newTx;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'FINANCEIRO',
      recordId: transaction.id,
      details: `Transação financeira "${transaction.description}" de R$ ${transaction.amount} (${transaction.direction}) criada.`,
    });

    return { success: true, data: serializePrisma(transaction) };
  } catch (error: any) {
    console.error('Error creating financial transaction:', error);
    return { success: false, error: error.message };
  }
}

export async function getFinancialTransactions(filters?: {
  type?: string;
  status?: string;
  cashRegisterId?: string;
  bankAccountId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const where: any = { companyId: session.companyId };
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.cashRegisterId) where.cashRegisterId = filters.cashRegisterId;
    if (filters?.bankAccountId) where.bankAccountId = filters.bankAccountId;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      include: {
        bankAccount: true,
        paymentMethod: true,
        costCenter: true,
        financialAccount: true,
        cashRegister: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { success: true, data: serializePrisma(transactions) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function cancelFinancialTransaction(id: string, reason: string) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.financialTransaction.findFirst({
        where: { id, companyId: session.companyId },
      });

      if (!transaction) throw new Error('Transação não encontrada.');
      if (transaction.status === 'CANCELLED') throw new Error('Transação já cancelada.');

      const updated = await tx.financialTransaction.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Reverter saldo bancário se a transação já foi paga
      if (transaction.status === 'PAID' && transaction.bankAccountId) {
        const reversalDelta = transaction.direction === 'IN' ? -Number(transaction.amount) : Number(transaction.amount);
        await tx.bankAccount.update({
          where: { id: transaction.bankAccountId },
          data: { currentBalance: { increment: new Prisma.Decimal(reversalDelta) } },
        });
      }

      return updated;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CANCELAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Transação "${id}" cancelada. Motivo: ${reason}`,
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// DASHBOARD SUMMARY — Resumo Financeiro
// =============================================================================

export async function getFinancialDashboardSummary() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [bankAccounts, monthlyIncome, monthlyExpense, overdueReceivables, openCashRegister] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { companyId: session.companyId, isActive: true },
        select: { id: true, name: true, currentBalance: true, isCashAccount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: {
          companyId: session.companyId,
          direction: 'IN',
          status: 'PAID',
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: {
          companyId: session.companyId,
          direction: 'OUT',
          status: 'PAID',
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.accountsReceivable.aggregate({
        where: {
          companyId: session.companyId,
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { lt: now },
        },
        _sum: { remainingAmount: true },
        _count: true,
      }),
      prisma.cashRegister.findFirst({
        where: { companyId: session.companyId, status: 'OPEN' },
        include: { bankAccount: true, openedBy: true },
      }),
    ]);

    const totalBalance = bankAccounts.reduce((sum, b) => sum + Number(b.currentBalance), 0);
    const income = Number(monthlyIncome._sum.amount ?? 0);
    const expense = Number(monthlyExpense._sum.amount ?? 0);

    return {
      success: true,
      data: {
        totalBalance,
        bankAccounts,
        monthlyIncome: income,
        monthlyExpense: expense,
        monthlyResult: income - expense,
        overdueReceivables: {
          count: overdueReceivables._count,
          total: Number(overdueReceivables._sum.remainingAmount ?? 0),
        },
        openCashRegister,
      },
    };
  } catch (error: any) {
    console.error('Error getting financial dashboard summary:', error);
    return { success: false, error: error.message };
  }
}
