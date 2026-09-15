'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { sanitizeAuditDetails } from '@/lib/auth/audit-sanitization';
import { Prisma } from '@prisma/client';
import { AccountsReceivableSchema, PayInstallmentSchema } from './financial-schemas';
import { addDays } from 'date-fns';
import { receivableTenantWhere, relatedTenantWhere } from './receivables-tenant-security';

// =============================================================================
// ACCOUNTS RECEIVABLE SERVICE — Contas a Receber
// Regras:
//   - Suporte a parcelamento (N parcelas com vencimentos escalonados)
//   - Baixa parcial: atualiza paidAmount, remainingAmount e status
//   - Baixa total: marca como PAID + paidAt
//   - Cancelamento: marca como CANCELLED
//   - Toda operação gera ActivityLog
//   - Toda baixa de valor inteiro atualiza saldo bancário via FinancialTransaction
// =============================================================================

export async function getAccountsReceivable(filters?: {
  status?: string;
  customerId?: string;
  startDueDate?: string;
  endDueDate?: string;
}) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const where: any = { companyId: session.companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.startDueDate || filters?.endDueDate) {
      where.dueDate = {};
      if (filters.startDueDate) where.dueDate.gte = new Date(filters.startDueDate);
      if (filters.endDueDate) where.dueDate.lte = new Date(filters.endDueDate);
    }

    const receivables = await prisma.accountsReceivable.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        financialAccount: { select: { id: true, name: true, code: true } },
        financialTransaction: { select: { id: true, description: true, paymentMethod: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 300,
    });

    return { success: true, data: serializePrisma(receivables) };
  } catch {
    return { success: false, error: 'Erro ao consultar contas a receber.' };
  }
}

export async function createAccountsReceivable(input: any) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');
  const parsed = AccountsReceivableSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { totalAmount, totalInstallments, dueDate, description, customerId, financialAccountId, notes } = parsed.data;
  const installmentAmount = totalAmount / totalInstallments;

  try {
    const installments = await prisma.$transaction(async (tx) => {
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: relatedTenantWhere(customerId, session.companyId), select: { id: true },
        });
        if (!customer) throw new Error('Cliente não encontrado.');
      }
      if (financialAccountId) {
        const financialAccount = await tx.financialAccount.findFirst({
          where: relatedTenantWhere(financialAccountId, session.companyId), select: { id: true },
        });
        if (!financialAccount) throw new Error('Conta financeira não encontrada.');
      }

      const baseDueDate = new Date(dueDate);
      const createdInstallments = [];

      for (let i = 0; i < totalInstallments; i++) {
        // Vencimento escalonado: parcela 1 = dueDate, parcela 2 = dueDate + 30 dias, etc.
        const installmentDueDate = i === 0 ? baseDueDate : addDays(baseDueDate, i * 30);

        const receivable = await tx.accountsReceivable.create({
          data: {
            companyId: session.companyId,
            customerId: customerId || null,
            financialAccountId: financialAccountId || null,
            installmentNumber: i + 1,
            totalInstallments,
            originalAmount: new Prisma.Decimal(installmentAmount),
            paidAmount: new Prisma.Decimal(0),
            remainingAmount: new Prisma.Decimal(installmentAmount),
            dueDate: installmentDueDate,
            status: 'PENDING',
            notes: notes || null,
          },
        });
        createdInstallments.push(receivable);
      }

      await writeActivityLog({
        context: session,
        action: 'RECEIVABLE_CREATE',
        module: 'RECEIVABLES',
        recordId: createdInstallments[0]?.id,
        details: 'Conta a receber manual criada.',
        metadata: {
          customerId: customerId ?? null,
          installmentCount: totalInstallments,
          installmentAmount: Number(installmentAmount),
          totalAmount: Number(totalAmount),
          dueDate: baseDueDate.toISOString(),
          origin: 'MANUAL',
        },
      }, { policy: 'CRITICAL', tx });

      return createdInstallments;
    });

    return { success: true, data: serializePrisma(installments) };
  } catch (error: any) {
    return { success: false, error: 'Erro ao criar contas a receber.' };
  }
}

export async function payInstallment(
  id: string,
  input: any,
  bankAccountId?: string,
  paymentMethodId?: string
) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  const parsed = PayInstallmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { amount, paidAt } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receivable = await tx.accountsReceivable.findFirst({
        where: receivableTenantWhere(id, session.companyId),
      });

      if (!receivable) throw new Error('Conta a receber não encontrada.');
      if (receivable.status === 'PAID') throw new Error('Esta parcela já foi liquidada.');
      if (receivable.status === 'CANCELLED') throw new Error('Esta parcela foi cancelada.');
      if (amount > Number(receivable.remainingAmount)) {
        throw new Error(`Valor de pagamento (R$ ${amount}) excede o saldo restante (R$ ${receivable.remainingAmount}).`);
      }

      if (bankAccountId) {
        const bankAccount = await tx.bankAccount.findFirst({
          where: { ...relatedTenantWhere(bankAccountId, session.companyId), isActive: true },
          select: { id: true },
        });
        if (!bankAccount) throw new Error('Conta bancária não encontrada.');
      }
      if (paymentMethodId) {
        const paymentMethod = await tx.paymentMethod.findFirst({
          where: { ...relatedTenantWhere(paymentMethodId, session.companyId), isActive: true },
          select: { id: true },
        });
        if (!paymentMethod) throw new Error('Forma de pagamento não encontrada.');
      }

      const newPaidAmount = Number(receivable.paidAmount) + amount;
      const newRemainingAmount = Number(receivable.originalAmount) - newPaidAmount;
      const isFullyPaid = newRemainingAmount <= 0;

      const updated = await tx.accountsReceivable.update({
        where: receivableTenantWhere(id, session.companyId),
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount),
          remainingAmount: new Prisma.Decimal(Math.max(0, newRemainingAmount)),
          status: isFullyPaid ? 'PAID' : 'PARTIAL',
          paidAt: isFullyPaid ? (paidAt ? new Date(paidAt) : new Date()) : receivable.paidAt,
        },
      });

      // Registrar entrada financeira e atualizar saldo bancário
      if (bankAccountId) {
        const financialTx = await tx.financialTransaction.create({
          data: {
            companyId: session.companyId,
            type: 'INCOME',
            direction: 'IN',
            status: 'PAID',
            bankAccountId,
            paymentMethodId: paymentMethodId || null,
            financialAccountId: receivable.financialAccountId || null,
            customerId: receivable.customerId || null,
            referenceType: 'AccountsReceivable',
            referenceId: id,
            sourceModule: 'FINANCEIRO',
            description: `Recebimento parcela ${receivable.installmentNumber}/${receivable.totalInstallments}`,
            amount: new Prisma.Decimal(amount),
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            createdByUserId: session.userId,
          },
        });

        await tx.bankAccount.update({
          where: relatedTenantWhere(bankAccountId, session.companyId),
          data: { currentBalance: { increment: new Prisma.Decimal(amount) } },
        });

        // Vincular transação à conta a receber
        await tx.accountsReceivable.update({
          where: receivableTenantWhere(id, session.companyId),
          data: { financialTransactionId: financialTx.id },
        });
      }

      await writeActivityLog({
        context: session,
        action: 'RECEIVABLE_PAYMENT',
        module: 'RECEIVABLES',
        recordId: id,
        details: 'Pagamento de conta a receber registrado.',
        metadata: {
          amount: Number(amount),
          paidAmount: { before: Number(receivable.paidAmount), after: newPaidAmount },
          remainingAmount: { before: Number(receivable.remainingAmount), after: Math.max(0, newRemainingAmount) },
          status: { before: receivable.status, after: updated.status },
          bankAccountId: bankAccountId ?? null,
          paymentMethodId: paymentMethodId ?? null,
        },
      }, { policy: 'CRITICAL', tx });

      return updated;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: 'Não foi possível registrar o recebimento.' };
  }
}

export async function cancelReceivable(id: string, reason?: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');
  try {
    await prisma.$transaction(async tx => {
      const receivable = await tx.accountsReceivable.findFirst({ where: receivableTenantWhere(id, session.companyId) });
      if (!receivable) throw new Error('Conta a receber não encontrada.');
      if (receivable.status === 'PAID') throw new Error('Não é possível cancelar uma parcela já paga.');
      if (receivable.status === 'CANCELLED') throw new Error('Esta parcela já está cancelada.');
      await tx.accountsReceivable.update({ where: receivableTenantWhere(id, session.companyId), data: { status: 'CANCELLED' } });
      await writeActivityLog({
        context: session, action: 'RECEIVABLE_CANCEL', module: 'RECEIVABLES', recordId: id,
        details: 'Conta a receber cancelada.',
        metadata: { status: { before: receivable.status, after: 'CANCELLED' }, amount: Number(receivable.originalAmount), reason: sanitizeAuditDetails(reason) },
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao cancelar conta a receber.' };
  }
}

export async function renegotiateReceivable(id: string, newDueDate: string, notes?: string) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  try {
    await prisma.$transaction(async tx => {
      const receivable = await tx.accountsReceivable.findFirst({ where: receivableTenantWhere(id, session.companyId) });
      if (!receivable) throw new Error('Conta a receber não encontrada.');
      if (receivable.status === 'PAID' || receivable.status === 'CANCELLED') throw new Error('Conta a receber não pode ser renegociada.');
      const dueDate = new Date(newDueDate);
      await tx.accountsReceivable.update({ where: receivableTenantWhere(id, session.companyId), data: { dueDate, status: 'RENEGOTIATED', notes: notes || receivable.notes } });
      await writeActivityLog({
        context: session, action: 'RECEIVABLE_UPDATE', module: 'RECEIVABLES', recordId: id,
        details: 'Conta a receber renegociada.',
        metadata: { changes: { dueDate: { before: receivable.dueDate.toISOString(), after: dueDate.toISOString() }, status: { before: receivable.status, after: 'RENEGOTIATED' } } },
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao renegociar conta a receber.' };
  }
}

export async function recalculateOverdueReceivables(companyId: string) {
  // Mantém o parâmetro apenas por compatibilidade; o tenant externo não possui autoridade.
  const auth = await requirePermission('FINANCEIRO', 'UPDATE');
  try {
    const now = new Date();
    const result = await prisma.accountsReceivable.updateMany({
      where: {
        companyId: auth.companyId,
        status: 'PENDING',
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
    return { success: true, updatedCount: result.count };
  } catch {
    return { success: false, error: 'Erro ao recalcular contas vencidas.' };
  }
}
