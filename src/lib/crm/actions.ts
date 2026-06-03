'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { customerWalletService } from '@/lib/wallet/customer-wallet-service';
import { z } from 'zod';

// ─── Zod Schemas ───

export const CustomerSchema = z.object({
  name: z.string().min(2, 'Nome inválido (mínimo 2 caracteres)'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  phone: z.string().min(8, 'Telefone inválido'),
  cpf: z.string().optional().nullable(),
  birthDay: z.number().int().min(1).max(31).optional().nullable(),
  birthMonth: z.number().int().min(1).max(12).optional().nullable(),
  birthYear: z.number().int().min(1900).max(2100).optional().nullable(),
  instagram: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ativo', 'inativo', 'arquivado']).default('ativo'),
});

export const ChildSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(2, 'Nome inválido'),
  birthDate: z.string().optional().nullable(), // ISO String or YYYY-MM-DD
  gender: z.string().optional().nullable(),
  shoeSize: z.string().optional().nullable(),
  clothingSize: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const WalletAdjustmentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive('O valor deve ser maior que zero'),
  type: z.enum(['credit', 'debit']),
  reason: z.string().min(3, 'Forneça um motivo claro'),
});

// ─── Customer Actions ───

export async function getCustomers() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customer.findMany({
      where: {
        companyId: session.companyId,
        status: { not: 'arquivado' },
      },
      include: {
        children: true,
        tagRelations: {
          include: { tag: true },
        },
        wallet: true,
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return { success: false, error: 'Erro ao buscar clientes.' };
  }
}

export async function createCustomer(rawData: z.infer<typeof CustomerSchema>) {
  const session = await requirePermission('CLIENTES', 'CREATE');
  try {
    const data = CustomerSchema.parse(rawData);

    // Validate unique phone within same company
    const existing = await prisma.customer.findFirst({
      where: {
        companyId: session.companyId,
        phone: data.phone,
      },
    });

    if (existing) {
      return { success: false, error: 'Este número de telefone já está cadastrado para outro cliente nesta empresa.' };
    }

    const customer = await prisma.customer.create({
      data: {
        companyId: session.companyId,
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        cpf: data.cpf || null,
        birthDay: data.birthDay || null,
        birthMonth: data.birthMonth || null,
        birthYear: data.birthYear || null,
        instagram: data.instagram || null,
        notes: data.notes || null,
        status: data.status,
        wallet: {
          create: { balance: 0.0 },
        },
      },
    });

    await prisma.customerHistory.create({
      data: {
        customerId: customer.id,
        actionType: 'CADASTRO',
        description: `Cliente cadastrado por ${session.name}`,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      module: 'CRM Clientes',
      recordId: customer.id,
      details: `Criou o cliente ${customer.name}`,
    });

    return { success: true, data: customer };
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return { success: false, error: error.message || 'Erro ao criar cliente.' };
  }
}

export async function updateCustomer(id: string, rawData: z.infer<typeof CustomerSchema>) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const data = CustomerSchema.parse(rawData);

    // Check uniqueness of phone
    const existing = await prisma.customer.findFirst({
      where: {
        companyId: session.companyId,
        phone: data.phone,
        id: { not: id },
      },
    });

    if (existing) {
      return { success: false, error: 'Outro cliente já possui este telefone cadastrado.' };
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        cpf: data.cpf || null,
        birthDay: data.birthDay || null,
        birthMonth: data.birthMonth || null,
        birthYear: data.birthYear || null,
        instagram: data.instagram || null,
        notes: data.notes || null,
        status: data.status,
      },
    });

    await prisma.customerHistory.create({
      data: {
        customerId: customer.id,
        actionType: 'EDICAO',
        description: `Dados do cliente atualizados por ${session.name}`,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'CRM Clientes',
      recordId: customer.id,
      details: `Editou dados do cliente ${customer.name}`,
    });

    return { success: true, data: customer };
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return { success: false, error: error.message || 'Erro ao atualizar cliente.' };
  }
}

export async function deleteCustomer(id: string) {
  const session = await requirePermission('CLIENTES', 'DELETE');
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: { status: 'arquivado' },
    });

    await prisma.customerHistory.create({
      data: {
        customerId: customer.id,
        actionType: 'EXCLUSAO',
        description: `Cliente marcado como arquivado (soft delete) por ${session.name}`,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'SOFT_DELETE',
      module: 'CRM Clientes',
      recordId: customer.id,
      details: `Arquivou o cliente ${customer.name}`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return { success: false, error: 'Erro ao remover cliente.' };
  }
}

// ─── Child Actions ───

export async function createChild(rawData: z.infer<typeof ChildSchema>) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const data = ChildSchema.parse(rawData);

    const child = await prisma.customerChild.create({
      data: {
        customerId: data.customerId,
        name: data.name,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender || null,
        shoeSize: data.shoeSize || null,
        clothingSize: data.clothingSize || null,
        notes: data.notes || null,
      },
    });

    await prisma.customerHistory.create({
      data: {
        customerId: data.customerId,
        actionType: 'FILHO_ADICIONADO',
        description: `Filho(a) "${child.name}" cadastrado(a) por ${session.name}`,
      },
    });

    return { success: true, data: child };
  } catch (error: any) {
    console.error('Error creating child:', error);
    return { success: false, error: error.message || 'Erro ao criar cadastro de filho.' };
  }
}

export async function deleteChild(id: string) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const child = await prisma.customerChild.delete({
      where: { id },
    });

    await prisma.customerHistory.create({
      data: {
        customerId: child.customerId,
        actionType: 'FILHO_REMOVIDO',
        description: `Cadastro de filho(a) "${child.name}" removido por ${session.name}`,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting child:', error);
    return { success: false, error: 'Erro ao remover cadastro de filho.' };
  }
}

// ─── Tag Actions ───

export async function getTags() {
  const session = await requirePermission('CRM', 'VIEW');
  try {
    const tags = await prisma.customerTag.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: tags };
  } catch (error: any) {
    console.error('Error getting tags:', error);
    return { success: false, error: 'Erro ao obter tags.' };
  }
}

export async function createTag(name: string, color?: string) {
  const session = await requirePermission('CRM', 'VIEW');
  try {
    const tag = await prisma.customerTag.upsert({
      where: {
        companyId_name: {
          companyId: session.companyId,
          name,
        },
      },
      update: { color: color || '#64748b' },
      create: {
        companyId: session.companyId,
        name,
        color: color || '#64748b',
      },
    });
    return { success: true, data: tag };
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return { success: false, error: 'Erro ao criar tag.' };
  }
}

export async function addTagToCustomer(customerId: string, tagId: string) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const relation = await prisma.customerTagRelation.upsert({
      where: {
        customerId_tagId: { customerId, tagId },
      },
      update: {},
      create: { customerId, tagId },
      include: { tag: true },
    });

    await prisma.customerHistory.create({
      data: {
        customerId,
        actionType: 'TAG_ADICIONADA',
        description: `Tag "${relation.tag.name}" vinculada por ${session.name}`,
      },
    });

    return { success: true, data: relation };
  } catch (error: any) {
    console.error('Error linking tag:', error);
    return { success: false, error: 'Erro ao vincular tag.' };
  }
}

export async function removeTagFromCustomer(customerId: string, tagId: string) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const relation = await prisma.customerTagRelation.delete({
      where: {
        customerId_tagId: { customerId, tagId },
      },
      include: { tag: true },
    });

    await prisma.customerHistory.create({
      data: {
        customerId,
        actionType: 'TAG_REMOVIDA',
        description: `Tag "${relation.tag.name}" desvinculada por ${session.name}`,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error unlinking tag:', error);
    return { success: false, error: 'Erro ao desvincular tag.' };
  }
}

// ─── Wallet Actions (Transactional) ───

export async function adjustWalletBalance(rawData: z.infer<typeof WalletAdjustmentSchema>) {
  const session = await requirePermission('FINANCEIRO', 'VIEW');
  try {
    const data = WalletAdjustmentSchema.parse(rawData);

    // Delegate to customerWalletService which implements the full ledger logic
    // (balanceBefore/balanceAfter tracking, expiresAt, activity log)
    const result = await customerWalletService.createManualAdjustment({
      customerId: data.customerId,
      amount: data.amount,
      type: data.type,
      reason: data.reason,
      createdById: session.userId,
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'CRM Carteira',
      recordId: data.customerId,
      details: `Ajuste de saldo (${data.type === 'credit' ? 'Crédito' : 'Débito'}): R$ ${data.amount.toFixed(2)} para o cliente ID ${data.customerId}`,
    });

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error adjusting wallet balance:', error);
    return { success: false, error: error.message || 'Erro ao realizar transação de saldo.' };
  }
}

// ─── History and Interaction ───

export async function getCustomerHistory(customerId: string) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerHistory.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching history:', error);
    return { success: false, error: 'Erro ao buscar histórico do cliente.' };
  }
}

// ─── Birthdays Query ───

export async function getBirthdayList(month: number) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    // 1. Fetch customers with birthday in month
    const customers = await prisma.customer.findMany({
      where: {
        companyId: session.companyId,
        birthMonth: month,
        status: { not: 'arquivado' },
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch children whose birthday matches and parent is active
    const childrenRaw = await prisma.customerChild.findMany({
      where: {
        customer: {
          companyId: session.companyId,
          status: { not: 'arquivado' },
        },
      },
      include: { customer: true },
    });

    // Filter children manually on JS for database independence of birthDate parts
    const matchingChildren = childrenRaw.filter((child) => {
      if (!child.birthDate) return false;
      const childMonth = new Date(child.birthDate).getMonth() + 1; // getMonth is 0-indexed
      return childMonth === month;
    });

    return {
      success: true,
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        type: 'Cliente',
        day: c.birthDay,
      })),
      children: matchingChildren.map((c) => ({
        id: c.id,
        name: `${c.name} (Filho de ${c.customer.name})`,
        phone: c.customer.phone,
        type: 'Filho',
        day: c.birthDate ? new Date(c.birthDate).getDate() : null,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching birthday list:', error);
    return { success: false, error: 'Erro ao buscar aniversariantes.' };
  }
}

// ─── Additional CRM Actions for Frontend Compatibility ───

export async function getChildren(customerId?: string) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerChild.findMany({
      where: customerId ? {
        customerId,
        customer: { companyId: session.companyId }
      } : {
        customer: { companyId: session.companyId }
      },
      include: { customer: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching children:', error);
    return { success: false, error: 'Erro ao buscar filhos.' };
  }
}

export async function updateChild(id: string, rawData: Partial<z.infer<typeof ChildSchema>> & { name?: string; birthDate?: string | null; gender?: string | null; shoeSize?: string | null; clothingSize?: string | null; notes?: string | null; preferenciaEstilo?: string | null; coresPreferidas?: string | null; personagensPreferidos?: string | null }) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    // Custom partial parsing
    const child = await prisma.customerChild.update({
      where: { id },
      data: {
        name: rawData.name,
        birthDate: rawData.birthDate ? new Date(rawData.birthDate) : undefined,
        gender: rawData.gender,
        shoeSize: rawData.shoeSize,
        clothingSize: rawData.clothingSize,
        notes: rawData.notes,
      },
      include: { customer: true }
    });

    await prisma.customerHistory.create({
      data: {
        customerId: child.customerId,
        actionType: 'FILHO_ATUALIZADO',
        description: `Dados de "${child.name}" atualizados por ${session.name}`,
      },
    });

    return { success: true, data: child };
  } catch (error: any) {
    console.error('Error updating child:', error);
    return { success: false, error: 'Erro ao atualizar cadastro do filho.' };
  }
}

export async function deleteTag(id: string) {
  const session = await requirePermission('CRM', 'VIEW');
  try {
    // Check if tag is used, if so delete relationships first (Prisma handles Cascade if config allows)
    await prisma.customerTag.delete({
      where: { id, companyId: session.companyId },
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return { success: false, error: 'Erro ao deletar tag.' };
  }
}

export async function getWallets() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerWallet.findMany({
      where: {
        customer: { companyId: session.companyId, status: { not: 'arquivado' } }
      },
      include: {
        customer: true,
        // Use new WalletTransaction ledger instead of legacy movements
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching wallets:', error);
    return { success: false, error: 'Erro ao buscar carteiras.' };
  }
}

/**
 * Returns ledger transactions for a wallet using the new WalletTransaction model.
 * Falls back to legacy movements if needed during transition period.
 */
export async function getWalletHistory(walletId: string) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    // Read from new WalletTransaction ledger (FASE 1 tables)
    const list = await prisma.walletTransaction.findMany({
      where: {
        walletId,
        wallet: { customer: { companyId: session.companyId } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching wallet history:', error);
    return { success: false, error: 'Erro ao buscar extrato da carteira.' };
  }
}

export async function getActivityLogs() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.activityLog.findMany({
      where: { companyId: session.companyId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return { success: false, error: 'Erro ao buscar logs de auditoria.' };
  }
}

/**
 * Returns all exchanges and returns for a customer using the new SaleExchange and SaleReturn models.
 * These replace the legacy ExchangeReturn model (Fase 3 removal is deferred until full validation).
 */
export async function getCustomerExchangeReturns(customerId: string) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    // Fetch from new FASE 1 tables
    const [exchanges, returns] = await Promise.all([
      prisma.saleExchange.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.saleReturn.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Normalize to a unified shape expected by the frontend
    const unified = [
      ...exchanges.map(e => ({
        id: e.id,
        type: 'EXCHANGE' as const,
        originalSaleId: e.originalSaleId,
        customerId: e.customerId,
        totalCredit: Number(e.creditGenerated),
        totalAmount: Number(e.totalAmount),
        refundMethod: 'WALLET',
        financialProcessed: e.financialProcessed,
        notes: e.notes,
        createdAt: e.createdAt,
      })),
      ...returns.map(r => ({
        id: r.id,
        type: 'RETURN' as const,
        originalSaleId: r.originalSaleId,
        customerId: r.customerId,
        totalCredit: Number(r.totalAmount),
        totalAmount: Number(r.totalAmount),
        refundMethod: r.refundMethod,
        financialProcessed: r.financialProcessed,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { success: true, data: unified };
  } catch (error: any) {
    console.error('Error fetching customer exchange returns:', error);
    return { success: false, error: 'Erro ao buscar trocas e devoluções.' };
  }
}



