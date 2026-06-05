'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { Prisma } from '@prisma/client';
import { AccountsReceivableSchema, PayInstallmentSchema } from './financial-schemas';
import { addDays } from 'date-fns';

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
  } catch (error: any) {
    return { success: false, error: error.message };
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

      return createdInstallments;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'FINANCEIRO',
      recordId: installments[0]?.id,
      details: `${totalInstallments}x parcela(s) de R$ ${installmentAmount.toFixed(2)} criadas. Total: R$ ${totalAmount}. Descrição: ${description}`,
    });

    return { success: true, data: serializePrisma(installments) };
  } catch (error: any) {
    console.error('Error creating accounts receivable:', error);
    return { success: false, error: error.message };
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
        where: { id, companyId: session.companyId },
      });

      if (!receivable) throw new Error('Conta a receber não encontrada.');
      if (receivable.status === 'PAID') throw new Error('Esta parcela já foi liquidada.');
      if (receivable.status === 'CANCELLED') throw new Error('Esta parcela foi cancelada.');
      if (amount > Number(receivable.remainingAmount)) {
        throw new Error(`Valor de pagamento (R$ ${amount}) excede o saldo restante (R$ ${receivable.remainingAmount}).`);
      }

      const newPaidAmount = Number(receivable.paidAmount) + amount;
      const newRemainingAmount = Number(receivable.originalAmount) - newPaidAmount;
      const isFullyPaid = newRemainingAmount <= 0;

      const updated = await tx.accountsReceivable.update({
        where: { id },
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
          where: { id: bankAccountId },
          data: { currentBalance: { increment: new Prisma.Decimal(amount) } },
        });

        // Vincular transação à conta a receber
        await tx.accountsReceivable.update({
          where: { id },
          data: { financialTransactionId: financialTx.id },
        });
      }

      return updated;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: result.status === 'PAID' ? 'BAIXA_TOTAL' : 'BAIXA_PARCIAL',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Pagamento de R$ ${amount} registrado na parcela ${result.installmentNumber}/${result.totalInstallments}. Status: ${result.status}. Restante: R$ ${result.remainingAmount}.`,
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    console.error('Error paying installment:', error);
    return { success: false, error: error.message };
  }
}

export async function cancelReceivable(id: string, reason?: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');
  try {
    const receivable = await prisma.accountsReceivable.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!receivable) return { success: false, error: 'Conta a receber não encontrada.' };
    if (receivable.status === 'PAID') return { success: false, error: 'Não é possível cancelar uma parcela já paga.' };
    if (receivable.status === 'CANCELLED') return { success: false, error: 'Esta parcela já está cancelada.' };

    await prisma.accountsReceivable.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CANCELAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Parcela ${receivable.installmentNumber}/${receivable.totalInstallments} de R$ ${receivable.originalAmount} cancelada.${reason ? ` Motivo: ${reason}` : ''}`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function renegotiateReceivable(id: string, newDueDate: string, notes?: string) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');
  try {
    const receivable = await prisma.accountsReceivable.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!receivable) return { success: false, error: 'Conta a receber não encontrada.' };
    if (receivable.status === 'PAID') return { success: false, error: 'Não é possível renegociar uma parcela já paga.' };
    if (receivable.status === 'CANCELLED') return { success: false, error: 'Não é possível renegociar uma parcela cancelada.' };

    await prisma.accountsReceivable.update({
      where: { id },
      data: {
        dueDate: new Date(newDueDate),
        status: 'RENEGOTIATED',
        notes: notes || receivable.notes,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'RENEGOCIAR',
      module: 'FINANCEIRO',
      recordId: id,
      details: `Parcela ${receivable.installmentNumber}/${receivable.totalInstallments} renegociada para ${newDueDate}.${notes ? ` Obs: ${notes}` : ''}`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function recalculateOverdueReceivables(companyId: string) {
  // Utilitário para marcar parcelas vencidas como OVERDUE automaticamente
  try {
    const now = new Date();
    const result = await prisma.accountsReceivable.updateMany({
      where: {
        companyId,
        status: 'PENDING',
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
    return { success: true, updatedCount: result.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
