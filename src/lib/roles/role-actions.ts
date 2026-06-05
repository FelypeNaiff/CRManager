'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { z } from 'zod';

const RoleFormSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório (mínimo 2 caracteres)'),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  isAdmin: z.boolean().default(false),
  defaultCommissionRate: z.number().min(0).max(100).optional().nullable(),
  defaultMaxDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
});

/**
 * Ensures there's always at least one active admin role in the company.
 * Throws an error if the operation would leave the company without any active admin role.
 */
async function ensureAdminProtection(companyId: string, roleIdBeingModified?: string, newIsAdmin?: boolean, newStatus?: string) {
  // If the role being modified is still going to be an active admin, we are safe.
  if (newIsAdmin === true && newStatus === 'ACTIVE') {
    return;
  }

  // Find all ACTIVE admin roles for this company
  const activeAdminRoles = await prisma.role.findMany({
    where: { companyId, isAdmin: true, status: 'ACTIVE' }
  });

  // If we are modifying an existing role that was an admin, and we are removing its admin status or deactivating it
  if (roleIdBeingModified) {
    const roleIsCurrentlyActiveAdmin = activeAdminRoles.some(r => r.id === roleIdBeingModified);
    if (roleIsCurrentlyActiveAdmin) {
      if (activeAdminRoles.length <= 1) {
        throw new Error('Operação bloqueada: A empresa deve ter no mínimo 1 grupo de Administrador ativo.');
      }
    }
  }
}

/**
 * Get all roles for the company
 */
export async function getRolesAction() {
  const session = await requirePermission('GRUPOS_USUARIOS', 'VIEW');
  try {
    const roles = await prisma.role.findMany({
      where: { companyId: session.companyId },
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(roles) };
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return { success: false, error: 'Erro ao buscar grupos de usuários.' };
  }
}

/**
 * Get a single role by ID
 */
export async function getRoleByIdAction(id: string) {
  const session = await requirePermission('GRUPOS_USUARIOS', 'VIEW');
  try {
    const role = await prisma.role.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!role) {
      return { success: false, error: 'Grupo não encontrado.' };
    }
    return { success: true, data: serializePrisma(role) };
  } catch (error: any) {
    console.error('Error fetching role:', error);
    return { success: false, error: 'Erro ao buscar grupo de usuários.' };
  }
}

/**
 * Create a new role
 */
export async function createRoleAction(rawData: any) {
  const session = await requirePermission('GRUPOS_USUARIOS', 'CREATE');
  try {
    const validatedData = RoleFormSchema.parse(rawData);

    // Check name duplication within the company
    const existingRole = await prisma.role.findFirst({
      where: { companyId: session.companyId, name: { equals: validatedData.name, mode: 'insensitive' } },
    });

    if (existingRole) {
      return { success: false, error: 'Já existe um grupo com este nome.' };
    }

    const newRole = await prisma.role.create({
      data: {
        companyId: session.companyId,
        name: validatedData.name,
        description: validatedData.description,
        status: validatedData.status,
        isAdmin: validatedData.isAdmin,
        defaultCommissionRate: validatedData.defaultCommissionRate,
        defaultMaxDiscountPercentage: validatedData.defaultMaxDiscountPercentage,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      module: 'GRUPOS_USUARIOS',
      recordId: newRole.id,
      details: `Criou o grupo: ${newRole.name}`,
    });

    return { success: true, data: { id: newRole.id } };
  } catch (error: any) {
    console.error('Error creating role:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    return { success: false, error: error.message || 'Erro ao criar grupo de usuários.' };
  }
}

/**
 * Update an existing role
 */
export async function updateRoleAction(id: string, rawData: any) {
  const session = await requirePermission('GRUPOS_USUARIOS', 'UPDATE');
  try {
    const validatedData = RoleFormSchema.parse(rawData);

    const existingRole = await prisma.role.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!existingRole) {
      return { success: false, error: 'Grupo não encontrado.' };
    }

    // Name uniqueness check
    const nameConflict = await prisma.role.findFirst({
      where: { 
        companyId: session.companyId, 
        name: { equals: validatedData.name, mode: 'insensitive' },
        id: { not: id }
      },
    });

    if (nameConflict) {
      return { success: false, error: 'Já existe outro grupo com este nome.' };
    }

    // Admin protection
    await ensureAdminProtection(session.companyId, id, validatedData.isAdmin, validatedData.status);

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        status: validatedData.status,
        isAdmin: validatedData.isAdmin,
        defaultCommissionRate: validatedData.defaultCommissionRate,
        defaultMaxDiscountPercentage: validatedData.defaultMaxDiscountPercentage,
      },
    });

    let details = `Atualizou o grupo: ${updatedRole.name}.`;
    if (existingRole.status !== updatedRole.status) {
      details += ` Status alterado para ${updatedRole.status}.`;
    }
    if (existingRole.isAdmin !== updatedRole.isAdmin) {
      details += ` isAdmin alterado para ${updatedRole.isAdmin}.`;
    }
    if (Number(existingRole.defaultCommissionRate) !== Number(updatedRole.defaultCommissionRate)) {
      details += ` Comissão alterada.`;
    }
    if (Number(existingRole.defaultMaxDiscountPercentage) !== Number(updatedRole.defaultMaxDiscountPercentage)) {
      details += ` Limite de desconto alterado.`;
    }

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'GRUPOS_USUARIOS',
      recordId: updatedRole.id,
      details,
    });

    return { success: true, data: { id: updatedRole.id } };
  } catch (error: any) {
    console.error('Error updating role:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    return { success: false, error: error.message || 'Erro ao atualizar grupo.' };
  }
}
