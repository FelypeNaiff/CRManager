'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';

export async function getFinancialCalendarAction(month: number, year: number) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  // Determinar range de datas
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    // Buscar Despesas (Contas a Pagar) - Usamos FinancialTransaction tipo EXPENSE
    const payables = await prisma.financialTransaction.findMany({
      where: {
        companyId: session.companyId,
        type: 'EXPENSE',
        direction: 'OUT',
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        costCenter: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Buscar Receitas (Contas a Receber)
    const receivables = await prisma.accountsReceivable.findMany({
      where: {
        companyId: session.companyId,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Consolidar as transações INCOME diretas também (que não geraram AccountsReceivable)
    const directIncomes = await prisma.financialTransaction.findMany({
      where: {
        companyId: session.companyId,
        type: 'INCOME',
        direction: 'IN',
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return {
      success: true,
      data: serializePrisma({
        payables,
        receivables,
        directIncomes,
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao carregar calendário financeiro.',
    };
  }
}
