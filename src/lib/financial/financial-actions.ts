'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog as writeModernActivityLog, writeLegacyActivityLog as writeActivityLog } from '@/lib/auth/activity-log';
import { sanitizeAuditDetails } from '@/lib/auth/audit-sanitization';
import { Prisma } from '@prisma/client';
import {
  BankAccountSchema,
  CostCenterSchema,
  FinancialAccountSchema,
  PaymentMethodSchema,
  FinancialTransactionSchema,
} from './financial-schemas';
import { financialTenantWhere } from './financial-tenant-security';
import { publicActionError } from '@/lib/auth/public-action-error';
import { serializeFinancialDashboardData } from './dashboard-serialization';

async function validateFinancialTransactionRelations(
  tx: Prisma.TransactionClient,
  companyId: string,
  data: {
    bankAccountId?: string | null;
    cashRegisterId?: string | null;
    paymentMethodId?: string | null;
    costCenterId?: string | null;
    financialAccountId?: string | null;
    customerId?: string | null;
  },
) {
  const [bankAccount, cashRegister, paymentMethod, costCenter, financialAccount, customer] = await Promise.all([
    data.bankAccountId ? tx.bankAccount.findFirst({ where: { ...financialTenantWhere(data.bankAccountId, companyId), isActive: true }, select: { id: true } }) : null,
    data.cashRegisterId ? tx.cashRegister.findFirst({
      where: { ...financialTenantWhere(data.cashRegisterId, companyId), status: 'OPEN' },
      select: { id: true, bankAccountId: true },
    }) : null,
    data.paymentMethodId ? tx.paymentMethod.findFirst({ where: { ...financialTenantWhere(data.paymentMethodId, companyId), isActive: true }, select: { id: true } }) : null,
    data.costCenterId ? tx.costCenter.findFirst({ where: { ...financialTenantWhere(data.costCenterId, companyId), isActive: true }, select: { id: true } }) : null,
    data.financialAccountId ? tx.financialAccount.findFirst({ where: { ...financialTenantWhere(data.financialAccountId, companyId), isActive: true }, select: { id: true } }) : null,
    data.customerId ? tx.customer.findFirst({ where: financialTenantWhere(data.customerId, companyId), select: { id: true } }) : null,
  ]);

  if (data.bankAccountId && !bankAccount) throw new Error('Vínculo financeiro inválido.');
  if (data.cashRegisterId && !cashRegister) throw new Error('Vínculo financeiro inválido.');
  if (data.paymentMethodId && !paymentMethod) throw new Error('Vínculo financeiro inválido.');
  if (data.costCenterId && !costCenter) throw new Error('Vínculo financeiro inválido.');
  if (data.financialAccountId && !financialAccount) throw new Error('Vínculo financeiro inválido.');
  if (data.customerId && !customer) throw new Error('Vínculo financeiro inválido.');
  if (cashRegister && data.bankAccountId && cashRegister.bankAccountId !== data.bankAccountId) {
    throw new Error('Vínculo financeiro inválido.');
  }
}

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
  } catch {
    return { success: false, error: 'Erro ao consultar contas bancárias.' };
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
  } catch {
    return { success: false, error: 'Erro ao consultar conta bancária.' };
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
  } catch {
    return { success: false, error: 'Erro ao criar conta bancária.' };
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
  } catch {
    return { success: false, error: 'Erro ao atualizar conta bancária.' };
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
  } catch {
    return { success: false, error: 'Erro ao arquivar conta bancária.' };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
  }
}

export async function updatePaymentMethod(id: string, input: any) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  const parsed = PaymentMethodSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const current = await prisma.paymentMethod.findFirst({
      where: { id, companyId: session.companyId },
      include: { _count: { select: { salePayments: true, transactions: true } } },
    });
    if (!current) return { success: false, error: 'Forma de pagamento não encontrada.' };

    const data: any = { ...parsed.data };
    if (parsed.data.feePercentage !== undefined) {
      data.feePercentage = new Prisma.Decimal(parsed.data.feePercentage);
    }

    const hasHistoricalReferences = current._count.salePayments > 0 || current._count.transactions > 0;
    const changesHistoricalRule =
      (parsed.data.type !== undefined && parsed.data.type !== current.type)
      || (parsed.data.allowsInstallments !== undefined && parsed.data.allowsInstallments !== current.allowsInstallments)
      || (parsed.data.autoReceive !== undefined && parsed.data.autoReceive !== current.autoReceive)
      || (parsed.data.requiresAuthorization !== undefined && parsed.data.requiresAuthorization !== current.requiresAuthorization)
      || (parsed.data.feePercentage !== undefined && !current.feePercentage.equals(parsed.data.feePercentage))
      || (parsed.data.settlementDays !== undefined && parsed.data.settlementDays !== current.settlementDays);
    if (hasHistoricalReferences && changesHistoricalRule) {
      return {
        success: false,
        error: 'Esta forma de pagamento possui histórico. Apenas o nome pode ser alterado.',
      };
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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
  }
}

export async function deletePaymentMethod(id: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');
  try {
    const method = await prisma.paymentMethod.findFirst({ where: { id, companyId: session.companyId } });
    if (!method) return { success: false, error: 'Forma de pagamento não encontrada.' };
    if (method.isSystemDefault) return { success: false, error: 'Formas de pagamento padrão do sistema não podem ser excluídas.' };

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
    return { success: false, error: publicActionError(error, 'Erro ao processar operação financeira.') };
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
      await validateFinancialTransactionRelations(tx, session.companyId, parsed.data);

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
          where: financialTenantWhere(parsed.data.bankAccountId, session.companyId),
          data: { currentBalance: { increment: new Prisma.Decimal(delta) } },
        });
      }

      await writeModernActivityLog({
        context: session,
        action: 'FINANCIAL_TRANSACTION_CREATE',
        module: 'FINANCIAL',
        recordId: newTx.id,
        details: 'Lançamento financeiro criado.',
        metadata: {
          type: newTx.type,
          direction: newTx.direction,
          amount: Number(newTx.amount),
          status: newTx.status,
          bankAccountId: newTx.bankAccountId,
          costCenterId: newTx.costCenterId,
          dueDate: newTx.dueDate?.toISOString() ?? null,
          origin: 'MANUAL',
        },
      }, { policy: 'CRITICAL', tx });

      return newTx;
    });

    return { success: true, data: serializePrisma(transaction) };
  } catch {
    return { success: false, error: 'Não foi possível criar a transação financeira.' };
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
  } catch {
    return { success: false, error: 'Erro ao consultar transações financeiras.' };
  }
}

export async function cancelFinancialTransaction(id: string, reason: string) {
  const session = await requirePermission('FINANCEIRO', 'CANCEL');
  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.financialTransaction.findFirst({
        where: { id, companyId: session.companyId },
      });

      if (!transaction) throw new Error('Transação não encontrada.');
      if (transaction.status === 'CANCELLED') throw new Error('Transação já cancelada.');

      const updated = await tx.financialTransaction.update({
        where: financialTenantWhere(id, session.companyId),
        data: { status: 'CANCELLED' },
      });

      // Reverter saldo bancário se a transação já foi paga
      if (transaction.status === 'PAID' && transaction.bankAccountId) {
        const bankAccount = await tx.bankAccount.findFirst({
          where: financialTenantWhere(transaction.bankAccountId, session.companyId),
          select: { id: true },
        });
        if (!bankAccount) throw new Error('Transação não encontrada.');
        const reversalDelta = transaction.direction === 'IN' ? -Number(transaction.amount) : Number(transaction.amount);
        await tx.bankAccount.update({
          where: financialTenantWhere(transaction.bankAccountId, session.companyId),
          data: { currentBalance: { increment: new Prisma.Decimal(reversalDelta) } },
        });
      }

      await writeModernActivityLog({
        context: session,
        action: 'FINANCIAL_TRANSACTION_CANCEL',
        module: 'FINANCIAL',
        recordId: id,
        details: 'Lançamento financeiro cancelado.',
        metadata: {
          status: { before: transaction.status, after: 'CANCELLED' },
          amount: Number(transaction.amount),
          reason: sanitizeAuditDetails(reason),
        },
      }, { policy: 'CRITICAL', tx });

      return updated;
    });

    return { success: true, data: serializePrisma(result) };
  } catch {
    return { success: false, error: 'Não foi possível cancelar a transação financeira.' };
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
    const serialized = serializeFinancialDashboardData(bankAccounts, openCashRegister);

    return {
      success: true,
      data: {
        totalBalance,
        bankAccounts: serialized.bankAccounts,
        monthlyIncome: income,
        monthlyExpense: expense,
        monthlyResult: income - expense,
        overdueReceivables: {
          count: overdueReceivables._count,
          total: Number(overdueReceivables._sum.remainingAmount ?? 0),
        },
        openCashRegister: serialized.openCashRegister,
      },
    };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao carregar resumo financeiro.') };
  }
}
