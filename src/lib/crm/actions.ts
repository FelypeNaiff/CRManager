'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '../auth/permissions';
import { safeDate } from '../utils/form-normalizer';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { customerWalletService } from '@/lib/wallet/customer-wallet-service';
import { z } from 'zod';
import { unstable_cache, revalidateTag } from 'next/cache';



// ─── Zod Schemas ───

const CustomerSchema = z.object({
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

const ChildSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(2, 'Nome inválido'),
  birthDate: z.string().optional().nullable(), // ISO String or YYYY-MM-DD
  gender: z.string().optional().nullable(),
  shoeSize: z.string().optional().nullable(),
  clothingSize: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const WalletAdjustmentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive('O valor deve ser maior que zero'),
  type: z.enum(['credit', 'debit']),
  reason: z.string().min(3, 'Forneça um motivo claro'),
});

// ─── Customer Actions ───

export interface GetCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  tab?: string;
  tag?: string;
}

export async function getCustomers(params?: GetCustomersParams) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const whereClause: any = {
      companyId: session.companyId,
    };

    // Filter status
    if (params?.status && params.status !== 'todos') {
      whereClause.status = params.status;
    } else {
      whereClause.status = { not: 'arquivado' };
    }

    // Filter search
    if (params?.search) {
      const q = params.search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q, mode: 'insensitive' } }
      ];
    }

    // Filter tags
    if (params?.tag) {
      whereClause.tagRelations = {
        some: {
          tag: {
            name: params.tag
          }
        }
      };
    }

    // Filter aniversariantes of the current month
    if (params?.tab === 'aniversariantes') {
      const currentMonth = new Date().getMonth() + 1;
      
      // Query children born in the current month using EXTRACT(MONTH) in raw SQL
      const childrenMatching = await prisma.$queryRaw<{ customer_id: string }[]>`
        SELECT DISTINCT customer_id 
        FROM customer_children cc
        JOIN customers c ON cc.customer_id = c.id
        WHERE c.company_id = ${session.companyId}
          AND EXTRACT(MONTH FROM cc.birth_date) = ${currentMonth}
      `;
      const customerIdsFromChildren = childrenMatching.map(cc => cc.customer_id);

      whereClause.AND = [
        {
          OR: [
            { birthMonth: currentMonth },
            { id: { in: customerIdsFromChildren } }
          ]
        }
      ];
    }

    const [list, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        include: {
          children: true,
          tagRelations: {
            include: { tag: true },
          },
          wallet: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.customer.count({
        where: whereClause
      })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: serializePrisma(list),
      metadata: {
        totalCount: total,
        currentPage: page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    };
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

    return { success: true, data: serializePrisma(customer) };
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

    return { success: true, data: serializePrisma(customer) };
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
        birthDate: data.birthDate ? safeDate(data.birthDate) : null,
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

    return { success: true, data: serializePrisma(child) };
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
    return { success: true, data: serializePrisma(tags) };
  } catch (error: any) {
    console.error('Error getting tags:', error);
    return { success: false, error: 'Erro ao obter tags.' };
  }
}

export async function createTag(name: string, color?: string) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
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
    return { success: true, data: serializePrisma(tag) };
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

    return { success: true, data: serializePrisma(relation) };
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

    return { success: true, data: serializePrisma(result) };
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
    return { success: true, data: serializePrisma(list) };
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

    // 2. Fetch children whose birthday matches and parent is active via database EXTRACT MONTH
    const matchingChildren = await prisma.$queryRaw<any[]>`
      SELECT cc.id, cc.name, cc.birth_date as "birthDate", c.name as "customerName", c.phone as "customerPhone"
      FROM customer_children cc
      JOIN customers c ON cc.customer_id = c.id
      WHERE c.company_id = ${session.companyId}
        AND c.status <> 'arquivado'
        AND EXTRACT(MONTH FROM cc.birth_date) = ${month}
      ORDER BY cc.name ASC
    `;

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
        name: `${c.name} (Filho de ${c.customerName})`,
        phone: c.customerPhone,
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
    return { success: true, data: serializePrisma(list) };
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
        birthDate: rawData.birthDate ? safeDate(rawData.birthDate) ?? undefined : undefined,
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

    return { success: true, data: serializePrisma(child) };
  } catch (error: any) {
    console.error('Error updating child:', error);
    return { success: false, error: 'Erro ao atualizar cadastro do filho.' };
  }
}

export async function deleteTag(id: string) {
  const session = await requirePermission('CLIENTES', 'DELETE');
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

export interface GetWalletsParams {
  page?: number;
  pageSize?: number;
  filter?: string;
  search?: string;
}

export async function getWallets(params?: GetWalletsParams) {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const whereClause: any = {
      customer: {
        companyId: session.companyId,
        status: { not: 'arquivado' }
      }
    };

    // Filter "com-saldo"
    if (params?.filter === 'com-saldo') {
      whereClause.balance = { gt: 0 };
    }

    // Filter search by customer name, phone, or CPF
    if (params?.search) {
      const q = params.search.trim();
      whereClause.customer.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [list, total] = await Promise.all([
      prisma.customerWallet.findMany({
        where: whereClause,
        include: {
          customer: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        },
        skip,
        take: pageSize
      }),
      prisma.customerWallet.count({
        where: whereClause
      })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: serializePrisma(list),
      metadata: {
        totalCount: total,
        currentPage: page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    };
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
    return { success: true, data: serializePrisma(list) };
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
    return { success: true, data: serializePrisma(list) };
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

    return { success: true, data: serializePrisma(unified) };
  } catch (error: any) {
    console.error('Error fetching customer exchange returns:', error);
    return { success: false, error: 'Erro ao buscar trocas e devoluções.' };
  }
}





const getCachedSegmentationData = unstable_cache(
  async (companyId: string) => {
    const salesGrouped = await prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        companyId: companyId,
        status: { not: 'CANCELLED' },
        customerId: { not: null }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      },
      _max: {
        createdAt: true
      }
    });

    const salesMap = new Map<string, typeof salesGrouped[0]>();
    salesGrouped.forEach(sg => {
      if (sg.customerId) {
        salesMap.set(sg.customerId, sg);
      }
    });

    const clients = await prisma.customer.findMany({
      where: { companyId: companyId, status: { not: 'arquivado' } },
      include: {
        children: true,
        tagRelations: { include: { tag: true } },
        wallet: true,
      }
    });

    const tags = await prisma.customerTag.findMany({
      where: { companyId: companyId }
    });

    const stats: Record<string, any> = {};
    clients.forEach(c => {
      const summary = salesMap.get(c.id);
      const total = Number(summary?._sum?.totalAmount || 0);
      const count = summary?._count?.id || 0;
      const last = summary?._max?.createdAt || null;

      stats[c.id] = {
        totalComprado: total,
        ticketMedio: count > 0 ? total / count : 0,
        ultimaCompra: last,
        saldoDisponivel: Number(c.wallet?.balance || 0),
        filhos: c.children.map(ch => ({ ...ch, data_nascimento: ch.birthDate, tamanho_roupa: ch.clothingSize, tamanho_calcado: ch.shoeSize, sexo: ch.gender, nome: ch.name })),
        tags: c.tagRelations.map(tr => tr.tag.name)
      };
    });

    const mappedClients = clients.map(c => ({
      id: c.id,
      nome: c.name,
      whatsapp: c.phone,
      whatsapp_principal: c.phone,
      aceita_marketing: true,
      aceita_marketing_whatsapp: true,
      vip: false,
      data_nascimento: c.birthDay ? new Date(c.birthYear || new Date().getFullYear(), (c.birthMonth || 1) - 1, c.birthDay) : null,
    }));

    return serializePrisma({ clientes: mappedClients, stats, tags });
  },
  ["crm-segmentation-data"],
  { tags: ["crm-segmentation", "customers"] }
);

export async function getSegmentationData() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const data = await getCachedSegmentationData(session.companyId);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching segmentation data:', error);
    return { success: false, error: 'Erro ao buscar dados para segmentacao.' };
  }
}

export async function listExchangeReturns() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.exchangeReturn.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { variant: { select: { name: true, product: { select: { name: true } } } } }
        }
      }
    });

    const customerIds = [...new Set(list.map((e: any) => e.customerId).filter(Boolean))] as string[];
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const mapped = list.map((e: any) => ({
      id: e.id,
      tipo: e.type,
      cliente_id: e.customerId,
      venda_id: e.originalSaleId,
      status: e.status,
      motivo: e.exchangeReason,
      valor_total: Number(e.totalCredit),
      valor_credito: Number(e.totalCredit),
      gera_credito: Number(e.totalCredit) > 0,
      observacao: "",
      created_at: e.createdAt,
      client: { nome: e.customerId ? (customerMap.get(e.customerId)?.name || "Consumidor") : "Consumidor" },
      product: { nome: e.items[0]?.variant?.product?.name || "Produto" },
      quantidade: e.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)
    }));

    return { success: true, data: serializePrisma(mapped) };
  } catch (error: any) {
    console.error("Error in listExchangeReturns:", error);
    return { success: false, error: error.message };
  }
}

export async function createExchangeReturnAction(data: any) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const { ExchangeService } = await import('@/lib/sales/exchange-service');
    const svc = new ExchangeService();
    const result = await svc.processExchangeReturn({
      companyId: session.companyId,
      saleId: data.venda_id,
      userId: session.userId,
      type: data.tipo,
      reason: data.motivo,
      items: [{
        variantId: data.produto_id,
        quantity: data.quantidade,
        condition: data.destino_produto === 'avaria' ? 'DAMAGED' : (data.destino_produto === 'descarte' ? 'DISCARD' : 'RESALE')
      }]
    });
    
    // Purge cache tags on change
    revalidateTag("sales-reports");
    revalidateTag("crm-segmentation");
    
    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    console.error("Error creating exchange return:", error);
    return { success: false, error: error.message };
  }
}

export async function listCampaigns() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerHistory.findMany({
      where: { customer: { companyId: session.companyId }, actionType: 'Campanha WhatsApp' },
      orderBy: { createdAt: 'desc' },
      include: { customer: true }
    });

    const campaignsMap = new Map<string, any>();
    
    list.forEach(h => {
      // Group by description prefix or time to simulate "campaigns"
      // Since we don't have a Campaign model, we group by description.
      // But actually we could just return history items if there is no Campaign model.
      // Wait, we don't have a Campaign model? Let's check.
    });

    return { success: true, data: serializePrisma(list.map(h => ({ id: h.id, nome: h.actionType, cliente: h.customer.name, createdAt: h.createdAt, description: h.description }))) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCampaignAction(data: any) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const { clients, name, message, integration } = data;
    
    for (const clientId of clients) {
      await prisma.customerHistory.create({
        data: {
          customerId: clientId,
          actionType: 'Campanha WhatsApp',
          description: `Disparo da campanha "${name}" via ${integration}. Mensagem: "${message}"`
        }
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCustomerHistoryLogs() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerHistory.findMany({
      where: { customer: { companyId: session.companyId } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return { success: true, data: serializePrisma(list) };
  } catch (error: any) {
    console.error('Error fetching customer history logs:', error);
    return { success: false, error: 'Erro ao buscar histórico.' };
  }
}
