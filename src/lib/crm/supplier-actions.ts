'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { tenantWhere } from './tenant-security';
import { serializePrisma } from '@/lib/serialize';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { z } from 'zod';

const supplierSchema = z.object({
  name: z.string().min(2, "Razão social deve ter pelo menos 2 caracteres"),
  tradeName: z.string().optional(),
  cnpjCpf: z.string().optional(),
  stateRegistration: z.string().optional(),
  personType: z.enum(["JURIDICA", "FISICA"]).default("JURIDICA"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  contactName: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, "UF deve ter 2 caracteres").optional(),
  notes: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export async function getSuppliers(filters?: { search?: string; page?: number; pageSize?: number }) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  const page = Math.max(1, filters?.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize || 20));

  const where: any = {
    companyId: session.companyId,
    isActive: true,
  };

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { tradeName: { contains: filters.search, mode: 'insensitive' } },
      { cnpjCpf: { contains: filters.search } }
    ];
  }

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { products: true, productLinks: true }
        }
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return { success: true, data: serializePrisma(suppliers), total, page, pageSize };
}

export async function getSupplierById(id: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  const supplier = await prisma.supplier.findFirst({
    where: tenantWhere(id, session.companyId),
    include: {
      _count: {
        select: { products: true, productLinks: true }
      }
    }
  });

  if (!supplier) return { success: false, error: 'Fornecedor não encontrado.' };
  return { success: true, data: serializePrisma(supplier) };
}

export async function createSupplierAction(rawInput: SupplierInput) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  
  try {
    const input = supplierSchema.parse(rawInput);
    
    // basic sanitization
    const cnpjCpfClean = input.cnpjCpf?.replace(/\D/g, '');

    if (cnpjCpfClean) {
      const existing = await prisma.supplier.findFirst({
        where: { companyId: session.companyId, cnpjCpf: input.cnpjCpf }
      });
      if (existing) throw new Error("Já existe um fornecedor cadastrado com este CNPJ/CPF.");
    }

    const supplier = await prisma.supplier.create({
      data: {
        ...input,
        companyId: session.companyId
      }
    });

    await writeActivityLog({
      context: session,
      action: 'SUPPLIER_CREATE',
      module: 'PRODUTOS',
      recordId: supplier.id,
      details: `Fornecedor criado: ${supplier.name}`
    }, { policy: 'BEST_EFFORT' });

    return { success: true, data: serializePrisma(supplier) };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao criar fornecedor." };
  }
}

export async function updateSupplierAction(id: string, rawInput: SupplierInput) {
  const session = await requirePermission('PRODUTOS', 'UPDATE');
  
  try {
    const input = supplierSchema.parse(rawInput);
    
    const existing = await prisma.supplier.findFirst({ where: tenantWhere(id, session.companyId) });
    if (!existing) throw new Error("Fornecedor não encontrado.");

    if (input.cnpjCpf && input.cnpjCpf !== existing.cnpjCpf) {
      const duplicate = await prisma.supplier.findFirst({
        where: { companyId: session.companyId, cnpjCpf: input.cnpjCpf, id: { not: id } }
      });
      if (duplicate) throw new Error("Já existe um fornecedor cadastrado com este CNPJ/CPF.");
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: input
    });

    await writeActivityLog({
      context: session,
      action: 'SUPPLIER_UPDATE',
      module: 'PRODUTOS',
      recordId: supplier.id,
      details: `Fornecedor atualizado: ${supplier.name}`
    }, { policy: 'BEST_EFFORT' });

    return { success: true, data: serializePrisma(supplier) };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao atualizar fornecedor." };
  }
}

export async function archiveSupplierAction(id: string) {
  const session = await requirePermission('PRODUTOS', 'DELETE');
  
  try {
    const existing = await prisma.supplier.findFirst({ 
      where: tenantWhere(id, session.companyId),
      include: {
        _count: { select: { products: true, productLinks: true } }
      }
    });
    if (!existing) throw new Error("Fornecedor não encontrado.");

    if (existing._count.products > 0 || existing._count.productLinks > 0) {
      throw new Error("Não é possível excluir o fornecedor pois existem produtos ativos atrelados a ele.");
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date() }
    });

    await writeActivityLog({
      context: session,
      action: 'SUPPLIER_ARCHIVE',
      module: 'PRODUTOS',
      recordId: supplier.id,
      details: `Fornecedor arquivado: ${supplier.name}`
    }, { policy: 'BEST_EFFORT' });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao excluir fornecedor." };
  }
}
