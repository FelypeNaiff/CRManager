'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';
import { PaymentMethodType, Prisma } from '@prisma/client';

export async function getPaymentMethodsAction() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { companyId: session.companyId, archivedAt: null },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: serializePrisma(paymentMethods) };
  } catch (error) {
    return { success: false, error: 'Erro ao carregar formas de pagamento.' };
  }
}

export async function savePaymentMethodAction(data: {
  id?: string;
  name: string;
  type: PaymentMethodType;
  feePercentage: number;
  settlementDays: number;
  isActive: boolean;
  allowsInstallments: boolean;
}) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');

  try {
    const feePercentageDec = new Prisma.Decimal(data.feePercentage);

    if (data.id) {
      const updated = await prisma.paymentMethod.update({
        where: { id: data.id, companyId: session.companyId },
        data: {
          name: data.name,
          type: data.type,
          feePercentage: feePercentageDec,
          settlementDays: data.settlementDays,
          isActive: data.isActive,
          allowsInstallments: data.allowsInstallments,
        },
      });
      return { success: true, data: serializePrisma(updated) };
    } else {
      const created = await prisma.paymentMethod.create({
        data: {
          companyId: session.companyId,
          name: data.name,
          type: data.type,
          feePercentage: feePercentageDec,
          settlementDays: data.settlementDays,
          isActive: data.isActive,
          allowsInstallments: data.allowsInstallments,
        },
      });
      return { success: true, data: serializePrisma(created) };
    }
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Já existe uma forma de pagamento com este nome.' };
    return { success: false, error: 'Erro ao salvar forma de pagamento.' };
  }
}

export async function archivePaymentMethodAction(id: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');

  try {
    const pm = await prisma.paymentMethod.findUnique({ where: { id, companyId: session.companyId } });
    if (!pm) return { success: false, error: 'Forma de pagamento não encontrada.' };
    if (pm.isSystemDefault) return { success: false, error: 'Não é possível arquivar a forma de pagamento padrão do sistema.' };

    await prisma.paymentMethod.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao arquivar forma de pagamento.' };
  }
}
