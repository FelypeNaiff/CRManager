'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';
import { Prisma } from '@prisma/client';

export async function getTransfersAction(monthFilter?: string) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  // Simplificando o filtro de mês
  let whereClause: any = { companyId: session.companyId, type: 'TRANSFER' };

  try {
    const transfers = await prisma.financialTransaction.findMany({
      where: whereClause,
      include: {
        bankAccount: { select: { id: true, name: true } },
        cashRegister: { select: { id: true, status: true, bankAccount: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit for performance
    });

    return { success: true, data: serializePrisma(transfers) };
  } catch (error) {
    return { success: false, error: 'Erro ao listar transferências.' };
  }
}

export async function createTransferAction(data: {
  amount: number;
  originAccountId: string;
  destinationAccountId: string;
  date: string;
  description: string;
}) {
  const session = await requirePermission('FINANCEIRO', 'CREATE');

  if (data.originAccountId === data.destinationAccountId) {
    return { success: false, error: 'As contas de origem e destino devem ser diferentes.' };
  }

  try {
    const amountDec = new Prisma.Decimal(data.amount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Débito na origem
      const originOut = await tx.financialTransaction.create({
        data: {
          companyId: session.companyId,
          type: 'TRANSFER',
          direction: 'OUT',
          status: 'PAID',
          amount: amountDec,
          dueDate: new Date(data.date),
          paidAt: new Date(data.date),
          bankAccountId: data.originAccountId, // assumindo contas bancárias
          description: `Transferência enviada para conta destino - ${data.description}`,
          createdByUserId: session.userId,
        },
      });

      // 2. Crédito no destino
      const destIn = await tx.financialTransaction.create({
        data: {
          companyId: session.companyId,
          type: 'TRANSFER',
          direction: 'IN',
          status: 'PAID',
          amount: amountDec,
          dueDate: new Date(data.date),
          paidAt: new Date(data.date),
          bankAccountId: data.destinationAccountId,
          referenceId: originOut.id,
          referenceType: 'TRANSFER_PAIR',
          description: `Transferência recebida da conta origem - ${data.description}`,
          createdByUserId: session.userId,
        },
      });

      // 3. Atualizar saldos das contas bancárias
      await tx.bankAccount.update({
        where: { id: data.originAccountId, companyId: session.companyId },
        data: { currentBalance: { decrement: amountDec } },
      });

      await tx.bankAccount.update({
        where: { id: data.destinationAccountId, companyId: session.companyId },
        data: { currentBalance: { increment: amountDec } },
      });

      return destIn;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: 'Erro ao processar transferência.' };
  }
}
