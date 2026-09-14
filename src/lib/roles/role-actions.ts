'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { z } from 'zod';
import { canSetAdministrativeRole, tenantEntityWhere } from '@/lib/auth/admin-tenant-security';

const RoleFormSchema = z.object({
  name: z.string().min(2, 'Nãome é obrigatório (mínimo 2 caracteres)'),
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
async function ensureAdminProtection(
  db: any,
  companyId: string,
  actorRoleId: string,
  roleIdBeingModified?: string,
  newIsAdmin?: boolean,
  newStatus?: string,
) {
  // If the role being modified is still going to be an active admin, we are safe.
  if (newIsAdmin === true && newStatus === 'ACTIVE') {
    return;
  }

  // Find all ACTIVE admin roles for this company
  const activeAdminRoles = await db.role.findMany({
    where: { companyId, isAdmin: true, status: 'ACTIVE' }
  });

  // If we are modifying an existing role that was an admin, and we are removing its admin status or deactivating it
  if (roleIdBeingModified) {
    const roleIsCurrentlyActiveAdmin = activeAdminRoles.some((role: { id: string }) => role.id === roleIdBeingModified);
    if (roleIsCurrentlyActiveAdmin) {
      if (actorRoleId === roleIdBeingModified) throw new Error('ADMIN_SELF_LOCKOUT');
      const otherActiveAdminUsers = await db.user.count({
        where: {
          companyId,
          status: 'ACTIVE',
          permitirAcesso: true,
          roleId: { not: roleIdBeingModified },
          role: { is: { isAdmin: true, status: 'ACTIVE' } },
        },
      });
      if (otherActiveAdminUsers === 0) throw new Error('LAST_ADMIN');
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
    if (!canSetAdministrativeRole(session, false, validatedData.isAdmin)) {
      return { success: false, error: 'Apenas administradores podem criar grupos administrativos.' };
    }

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
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    return { success: false, error: 'Erro ao criar grupo de usuários.' };
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
    if (!canSetAdministrativeRole(session, existingRole.isAdmin, validatedData.isAdmin)) {
      return { success: false, error: 'Apenas administradores podem alterar privilégios administrativos.' };
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

    const updatedRole = await prisma.$transaction(async (tx) => {
      await ensureAdminProtection(
        tx,
        session.companyId,
        session.roleId,
        id,
        validatedData.isAdmin,
        validatedData.status,
      );
      return tx.role.update({
        where: tenantEntityWhere(id, session.companyId),
        data: {
          name: validatedData.name,
          description: validatedData.description,
          status: validatedData.status,
          isAdmin: validatedData.isAdmin,
          defaultCommissionRate: validatedData.defaultCommissionRate,
          defaultMaxDiscountPercentage: validatedData.defaultMaxDiscountPercentage,
        },
      });
    }, { isolationLevel: 'Serializable' });

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
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    if (error instanceof Error && error.message === 'ADMIN_SELF_LOCKOUT') {
      return { success: false, error: 'Você não pode remover o próprio acesso administrativo.' };
    }
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      return { success: false, error: 'O tenant deve manter ao menos um usuário administrador ativo.' };
    }
    return { success: false, error: 'Erro ao atualizar grupo.' };
  }
}
