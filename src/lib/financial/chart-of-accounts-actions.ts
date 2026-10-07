'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';

export async function getChartOfAccountsAction() {
  const session = await requirePermission('FINANCEIRO', 'VIEW');

  try {
    const accounts = await prisma.financialAccount.findMany({
      where: { companyId: session.companyId, archivedAt: null },
      orderBy: { code: 'asc' },
    });

    return { success: true, data: serializePrisma(accounts) };
  } catch (error) {
    return { success: false, error: 'Erro ao carregar plano de contas.' };
  }
}

export async function saveChartOfAccountAction(data: {
  id?: string;
  code: string;
  name: string;
  type: string;
  parentId?: string;
  acceptsEntries: boolean;
}) {
  const session = await requirePermission('FINANCEIRO', 'UPDATE');

  try {
    if (data.id) {
      const updated = await prisma.financialAccount.update({
        where: { id: data.id, companyId: session.companyId },
        data: {
          code: data.code,
          name: data.name,
          type: data.type,
          parentId: data.parentId || null,
          acceptsEntries: data.acceptsEntries,
        },
      });
      return { success: true, data: serializePrisma(updated) };
    } else {
      const created = await prisma.financialAccount.create({
        data: {
          companyId: session.companyId,
          code: data.code,
          name: data.name,
          type: data.type,
          parentId: data.parentId || null,
          acceptsEntries: data.acceptsEntries,
        },
      });
      return { success: true, data: serializePrisma(created) };
    }
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Já existe uma conta com este código/nome.' };
    return { success: false, error: 'Erro ao salvar conta.' };
  }
}

export async function archiveChartOfAccountAction(id: string) {
  const session = await requirePermission('FINANCEIRO', 'DELETE');

  try {
    const children = await prisma.financialAccount.count({
      where: { parentId: id, archivedAt: null }
    });

    if (children > 0) {
      return { success: false, error: 'Não é possível remover uma conta que possui subcontas.' };
    }

    await prisma.financialAccount.update({
      where: { id, companyId: session.companyId },
      data: { archivedAt: new Date(), isActive: false },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao remover conta.' };
  }
}
