'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';

export async function getBankAccountsForReconciliationAction() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  try {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: serializePrisma(bankAccounts) };
  } catch (error) {
    return { success: false, error: 'Erro ao listar contas bancárias.' };
  }
}

export async function getTransactionsForReconciliationAction(bankAccountId: string, monthYear: string) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  const [monthStr, yearStr] = monthYear.split('/');
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const transactions = await prisma.financialTransaction.findMany({
      where: {
        companyId: session.companyId,
        bankAccountId,
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    return { success: true, data: serializePrisma(transactions) };
  } catch (error) {
    return { success: false, error: 'Erro ao carregar extrato da conta.' };
  }
}

export async function toggleReconciliationStatusAction(transactionId: string, currentStatus: string) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');

  try {
    // Para simplificar, usamos o próprio 'status' da transação ou um metadado, mas assumiremos que 'description' ou algo indica 'CONCILIADO'.
    // Mas na verdade o mais correto seria ter um boolean `isReconciled`. Como não tem no schema, vamos apenas atualizar a descrição como '[CONCILIADO]' ou se tivermos como usar o status.
    // O FinancialTransaction tem status PENDING, PAID, OVERDUE, CANCELLED, PARTIAL.
    // Conciliação geralmente ocorre para contas PAID. 
    // Vamos adicionar/remover o prefixo [CONCILIADO] na description.
    
    const tx = await prisma.financialTransaction.findUnique({ where: { id: transactionId, companyId: session.companyId } });
    if (!tx) return { success: false, error: 'Transação não encontrada.' };

    const isReconciled = tx.description.startsWith('[CONCILIADO]');
    let newDesc = tx.description;

    if (isReconciled) {
      newDesc = newDesc.replace('[CONCILIADO] ', '');
    } else {
      newDesc = `[CONCILIADO] ${newDesc}`;
    }

    await prisma.financialTransaction.update({
      where: { id: transactionId },
      data: { description: newDesc },
    });

    return { success: true, isReconciled: !isReconciled };
  } catch (error) {
    return { success: false, error: 'Erro ao atualizar conciliação.' };
  }
}
