'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';
import { Prisma } from '@prisma/client';
import { addCashMovement } from './cash-register-service';

export async function getEmployeeAdvancesAction(monthYear?: string) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  const whereClause: any = { companyId: session.companyId };
  if (monthYear) {
    whereClause.competenceMonth = monthYear;
  }

  try {
    const advances = await prisma.employeeAdvance.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, name: true, cargo: true } },
      },
      orderBy: { date: 'desc' },
    });

    return { success: true, data: serializePrisma(advances) };
  } catch (error) {
    return { success: false, error: 'Erro ao listar vales.' };
  }
}

export async function createEmployeeAdvanceAction(data: {
  employeeId: string;
  amount: number;
  date: string;
  competenceMonth: string;
  type: string;
  observation?: string;
  deductFromCashRegisterId?: string;
}) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar o Vale
      const advance = await tx.employeeAdvance.create({
        data: {
          companyId: session.companyId,
          employeeId: data.employeeId,
          amount: new Prisma.Decimal(data.amount),
          date: new Date(data.date),
          competenceMonth: data.competenceMonth,
          type: data.type as any,
          observation: data.observation,
          cashRegisterId: data.deductFromCashRegisterId || null,
        },
      });

      // 2. Se optou por sangria no caixa
      if (data.deductFromCashRegisterId && data.type === 'CASH_ADVANCE') {
        const cashRegister = await tx.cashRegister.findFirst({
          where: { id: data.deductFromCashRegisterId, companyId: session.companyId },
        });

        if (!cashRegister || cashRegister.status !== 'OPEN') {
          throw new Error('Caixa selecionado não está aberto ou não existe.');
        }

        await tx.cashMovement.create({
          data: {
            companyId: session.companyId,
            cashRegisterId: data.deductFromCashRegisterId,
            type: 'SANGRIA',
            amount: new Prisma.Decimal(data.amount),
            description: `Vale/Adiantamento (ID: ${advance.id}) para funcionário. Obs: ${data.observation || ''}`,
            createdByUserId: session.userId,
          },
        });
        
        // Atualiza a conta bancária vinculada ao caixa
        await tx.bankAccount.update({
          where: { id: cashRegister.bankAccountId },
          data: { currentBalance: { decrement: new Prisma.Decimal(data.amount) } },
        });
      }

      return advance;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao criar adiantamento.' };
  }
}

export async function settleEmployeeAdvanceAction(advanceId: string) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');

  try {
    const updated = await prisma.employeeAdvance.update({
      where: { id: advanceId, companyId: session.companyId },
      data: { status: 'DEDUCTED_PAYROLL' },
    });
    return { success: true, data: serializePrisma(updated) };
  } catch (error) {
    return { success: false, error: 'Erro ao liquidar o vale.' };
  }
}

export async function cancelEmployeeAdvanceAction(advanceId: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');

  try {
    const updated = await prisma.employeeAdvance.update({
      where: { id: advanceId, companyId: session.companyId },
      data: { status: 'CANCELLED' },
    });
    return { success: true, data: serializePrisma(updated) };
  } catch (error) {
    return { success: false, error: 'Erro ao cancelar o vale.' };
  }
}
