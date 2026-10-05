'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog, writeLegacyActivityLog } from '@/lib/auth/activity-log';
import { addAuditChange, type AuditChanges } from '@/lib/auth/audit-changes';
import { hashPin as hashAuthorizationPin, generateTemporaryPin, validatePin } from '@/lib/auth/pin-service';
import { hashPin as hashAccessPin } from '@/lib/auth/pin';
import { z } from 'zod';
import { tenantEntityWhere } from '@/lib/auth/admin-tenant-security';
import { assertUserRoleAssignmentAllowed } from './user-role-protection';

const UserCreateSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório (mínimo 2 caracteres)'),
  email: z.string().email('E-mail inválido'),
  cargo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  maxDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  roleId: z.string().min(1, 'Perfil de permissões é obrigatório'),
  pin: z.string().regex(/^\d{4}$/, 'PIN de acesso deve conter exatamente 4 dígitos').optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const UserUpdateSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório (mínimo 2 caracteres)').optional(),
  cargo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  roleId: z.string().min(1, 'Perfil de permissões é obrigatório').optional(),
  observacoes: z.string().optional().nullable(),
});

/**
 * Fetch all users for the active company
 */
export async function getUsersAction() {
  const session = await requirePermission('USUARIOS', 'VIEW');
  try {
    const users = await prisma.user.findMany({
      where: { 
        companyId: session.companyId,
        status: { not: 'DELETED' }
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        cargo: true,
        maxDiscountPercentage: true,
        updatedAt: true,
        role: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(users) };
  } catch (error: any) {
    return { success: false, error: 'Erro ao buscar usuários.' };
  }
}

/**
 * Delete a user (soft delete)
 */
export async function deleteUserAction(id: string) {
  try {
    const session = await requirePermission('USUARIOS', 'DELETE');
    if (session.userId === id) {
      return { success: false, error: 'Você não pode excluir seu próprio usuário.' };
    }

    const existingUser = await prisma.user.findFirst({
      where: tenantEntityWhere(id, session.companyId),
      include: { role: { select: { isAdmin: true } } },
    });

    if (!existingUser) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    if (existingUser.role?.isAdmin) {
      const otherAdminsCount = await prisma.user.count({
        where: {
          companyId: session.companyId,
          id: { not: id },
          status: 'ACTIVE',
          permitirAcesso: true,
          role: { is: { isAdmin: true, status: 'ACTIVE' } },
        },
      });
      if (otherAdminsCount === 0) {
        return { success: false, error: 'Não é possível excluir o único administrador ativo do sistema.' };
      }
    }

    try {
      // Tentativa de Hard Delete (exclusão definitiva)
      const deletedUser = await prisma.$transaction(async (tx) => {
        const deleted = await tx.user.delete({
          where: tenantEntityWhere(id, session.companyId),
        });

        await writeActivityLog({
          context: session,
          action: 'USER_DELETE',
          module: 'USERS',
          recordId: id,
          details: 'Usuário excluído definitivamente do sistema',
          metadata: { name: deleted.name, email: deleted.email },
        }, { policy: 'CRITICAL', tx });

        return deleted;
      });

      return { success: true, data: { id: deletedUser.id }, message: 'Usuário excluído definitivamente.' };
    } catch (e: any) {
      // Se houver erro de chave estrangeira (P2003), fazemos exclusão lógica (Soft Delete)
      if (e.code === 'P2003') {
        const deletedUser = await prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: tenantEntityWhere(id, session.companyId),
            data: {
              status: 'DELETED',
              permitirAcesso: false,
            },
          });

          await writeActivityLog({
            context: session,
            action: 'USER_DELETE',
            module: 'USERS',
            recordId: id,
            details: 'Usuário arquivado/excluído logicamente (já possuía movimentações)',
            metadata: { name: updated.name, email: updated.email },
          }, { policy: 'CRITICAL', tx });

          return updated;
        });
        return { success: true, data: { id: deletedUser.id }, message: 'Usuário arquivado (não pôde ser excluído definitivamente pois já possui movimentações).' };
      }
      throw e;
    }
  } catch (error: any) {
    if (error?.message === 'ACCESS_NOT_ALLOWED' || error?.message?.includes('permissão')) {
      return { success: false, error: 'Você não tem permissão para excluir usuários.' };
    }
    return { success: false, error: 'Erro ao excluir usuário.' };
  }
}

/** Lists active tenant Roles that may be assigned through the User form. */
export async function getAssignableRolesAction() {
  const session = await requirePermission('USUARIOS', 'VIEW');
  try {
    const roles = await prisma.role.findMany({
      where: {
        companyId: session.companyId,
        status: 'ACTIVE',
        ...(!session.isAdmin ? { isAdmin: false } : {}),
      },
      select: { id: true, name: true, isAdmin: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(roles) };
  } catch {
    return { success: false, error: 'Erro ao buscar perfis de permissões.' };
  }
}

/**
 * Fetch a single user by ID
 */
export async function getUserByIdAction(id: string) {
  const session = await requirePermission('USUARIOS', 'VIEW');
  try {
    const user = await prisma.user.findFirst({
      where: tenantEntityWhere(id, session.companyId),
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        cargo: true,
        maxDiscountPercentage: true,
        updatedAt: true,
        roleId: true,
      }
    });
    
    if (!user) {
      return { success: false, error: 'Usuário não encontrado.' };
    }
    
    return { success: true, data: serializePrisma(user) };
  } catch (error: any) {
    return { success: false, error: 'Erro ao buscar usuário.' };
  }
}

/**
 * Create a new user
 */
export async function createUserAction(rawData: any) {
  const session = await requirePermission('USUARIOS', 'CREATE');
  try {
    const validatedData = UserCreateSchema.parse(rawData);

    // Check if email already exists globally
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return { success: false, error: 'Este e-mail já está em uso.' };
    }

    if (!validatedData.pin) {
      return { success: false, error: 'PIN de acesso deve conter exatamente 4 dígitos.' };
    }
    const pinAccessHash = await hashAccessPin(validatedData.pin);
    const role = await prisma.role.findFirst({
      where: { id: validatedData.roleId, companyId: session.companyId, status: 'ACTIVE' },
      select: { id: true, isAdmin: true },
    });
    if (!role) {
      return { success: false, error: 'Perfil de permissões inválido ou inativo.' };
    }
    if (role.isAdmin && !session.isAdmin) {
      return { success: false, error: 'Apenas administradores podem atribuir um perfil administrativo.' };
    }

    const newUser = await prisma.$transaction(async tx => {
      const created = await tx.user.create({
        data: {
          companyId: session.companyId,
          roleId: role.id,
          name: validatedData.name,
          email: validatedData.email,
          cargo: validatedData.cargo,
          status: validatedData.status,
          maxDiscountPercentage: validatedData.maxDiscountPercentage,
          pinAccessHash,
          permitirAcesso: validatedData.status === 'ACTIVE',
        },
      });
      await writeActivityLog({
        context: session,
        action: 'USER_CREATE',
        module: 'USERS',
        recordId: created.id,
        details: 'Usuário criado',
        metadata: { status: created.status, roleId: created.roleId },
      }, { policy: 'CRITICAL', tx });
      return created;
    });

    return { success: true, data: { id: newUser.id } };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    return { success: false, error: 'Erro ao criar usuário.' };
  }
}

/** Define or replaces the four-digit PIN used to select an operational profile. */
export async function resetUserAccessPinAction(userId: string, newPin: string) {
  const session = await requirePermission('USUARIOS', 'RESET_PIN');
  try {
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, error: 'PIN de acesso deve conter exatamente 4 dígitos.' };
    }

    const existingUser = await prisma.user.findFirst({
      where: tenantEntityWhere(userId, session.companyId),
      select: { id: true },
    });
    if (!existingUser) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const pinAccessHash = await hashAccessPin(newPin);
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: tenantEntityWhere(userId, session.companyId),
        data: { pinAccessHash },
      });
      await writeActivityLog({
        context: session,
        action: 'USER_ACCESS_PIN_RESET',
        module: 'USERS',
        recordId: userId,
        details: 'PIN de acesso redefinido',
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao atualizar o PIN de acesso.' };
  }
}

/**
 * Update an existing user
 */
export async function updateUserAction(id: string, rawData: any) {
  const session = await requirePermission('USUARIOS', 'UPDATE');
  try {
    const validatedData = UserUpdateSchema.parse(rawData);

    const existingUser = await prisma.user.findFirst({
      where: tenantEntityWhere(id, session.companyId),
      include: { role: { select: { id: true, name: true, isAdmin: true, status: true } } },
    });

    if (!existingUser) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const targetRoleId = validatedData.roleId ?? existingUser.roleId;
    if (!targetRoleId) {
      return { success: false, error: 'Perfil de permissões é obrigatório.' };
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const targetRole = await tx.role.findFirst({
        where: { id: targetRoleId, companyId: session.companyId, status: 'ACTIVE' },
        select: { id: true, isAdmin: true },
      });
      if (!targetRole) throw new Error('INVALID_ROLE');
      const nextStatus = validatedData.status ?? existingUser.status;
      const removesAdministrativeAccess = !!existingUser.role?.isAdmin
        && (nextStatus !== 'ACTIVE' || !targetRole.isAdmin);
      let otherActiveAdmins = 0;
      if (removesAdministrativeAccess) {
        otherActiveAdmins = await tx.user.count({
          where: {
            companyId: session.companyId,
            id: { not: id },
            status: 'ACTIVE',
            permitirAcesso: true,
            role: { is: { isAdmin: true, status: 'ACTIVE' } },
          },
        });
      }
      assertUserRoleAssignmentAllowed({
        actorIsAdmin: session.isAdmin,
        actorUserId: session.userId,
        targetUserId: id,
        currentRoleIsAdmin: !!existingUser.role?.isAdmin,
        nextRoleIsAdmin: targetRole.isAdmin,
        nextStatus,
        otherActiveAdmins,
      });

      const updated = await tx.user.update({
        where: tenantEntityWhere(id, session.companyId),
        data: {
          name: validatedData.name,
          cargo: validatedData.cargo,
          status: validatedData.status,
          roleId: targetRole.id,
          permitirAcesso: validatedData.status === 'ACTIVE' ? true : existingUser.permitirAcesso,
          maxDiscountPercentage: validatedData.maxDiscountPercentage,
        },
        include: { role: { select: { name: true } } },
      });
      const changes: AuditChanges = {};
      addAuditChange(changes, 'name', existingUser.name, updated.name);
      addAuditChange(changes, 'cargo', existingUser.cargo, updated.cargo);
      addAuditChange(changes, 'status', existingUser.status, updated.status);
      addAuditChange(changes, 'permitirAcesso', existingUser.permitirAcesso, updated.permitirAcesso);
      addAuditChange(changes, 'maxDiscountPercentage', existingUser.maxDiscountPercentage, updated.maxDiscountPercentage);
      if (existingUser.roleId !== updated.roleId) {
        changes.role = {
          before: existingUser.role?.name ?? existingUser.roleId,
          after: updated.role?.name ?? updated.roleId,
        };
      }
      const action = existingUser.roleId !== updated.roleId
        ? 'USER_ROLE_CHANGE'
        : existingUser.status !== updated.status || existingUser.permitirAcesso !== updated.permitirAcesso
          ? 'USER_STATUS_CHANGE'
          : 'USER_UPDATE';
      await writeActivityLog({
        context: session,
        action,
        module: 'USERS',
        recordId: updated.id,
        details: 'Usuário atualizado',
        metadata: { changes },
      }, { policy: 'CRITICAL', tx });
      return updated;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: { id: updatedUser.id } };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    if (error instanceof Error && error.message === 'INVALID_ROLE') {
      return { success: false, error: 'Perfil de permissões inválido ou inativo.' };
    }
    if (error instanceof Error && error.message === 'ADMIN_ROLE_FORBIDDEN') {
      return { success: false, error: 'Apenas administradores podem atribuir um perfil administrativo.' };
    }
    if (error instanceof Error && error.message === 'ADMIN_SELF_LOCKOUT') {
      return { success: false, error: 'Você não pode remover o próprio acesso administrativo.' };
    }
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      return { success: false, error: 'O tenant deve manter ao menos um usuário administrador ativo.' };
    }
    return { success: false, error: 'Erro ao atualizar usuário.' };
  }
}

/**
 * Reset a user's authorization PIN (by admin)
 */
export async function resetUserPinAction(userId: string) {
  const session = await requirePermission('USUARIOS', 'UPDATE'); // Requires manage permissions
  try {
    const existingUser = await prisma.user.findFirst({
      where: tenantEntityWhere(userId, session.companyId),
    });

    if (!existingUser) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const tempPin = generateTemporaryPin();
    const hash = await hashAuthorizationPin(tempPin);

    await prisma.user.update({
      where: tenantEntityWhere(userId, session.companyId),
      data: {
        authorizationPinHash: hash,
        pinResetRequired: true,
      },
    });

    await writeLegacyActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'USUARIOS',
      recordId: userId,
      details: `Resetou o PIN de autorização para o usuário: ${existingUser.name}.`,
    });

    // The temporary PIN is returned ONCE to the frontend so the admin can copy it and give it to the user.
    // It is NEVER returned again.
    return { success: true, tempPin };
  } catch (error: any) {
    return { success: false, error: 'Erro ao resetar o PIN do usuário.' };
  }
}

/**
 * Change a user's authorization PIN (by the user themselves)
 */
export async function changeUserPinAction(userId: string, currentPin: string, newPin: string) {
  // Nãormally we would get the user id from the session (the user changing their own pin)
  // For the sake of this config flow, if an admin is forcing the change, they can provide it.
  const session = await requirePermission('USUARIOS', 'UPDATE'); 
  try {
    const user = await prisma.user.findFirst({
      where: tenantEntityWhere(userId, session.companyId),
    });

    if (!user) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    if (!user.authorizationPinHash) {
      return { success: false, error: 'O usuário não possui um PIN cadastrado para alterar. Solicite um reset.' };
    }

    const isValid = await validatePin(currentPin, user.authorizationPinHash);
    if (!isValid) {
      return { success: false, error: 'PIN atual inválido.' };
    }

    if (!newPin || newPin.length < 4 || newPin.length > 8) {
      return { success: false, error: 'Novo PIN deve ter entre 4 e 8 dígitos.' };
    }

    const newHash = await hashAuthorizationPin(newPin);

    await prisma.user.update({
      where: tenantEntityWhere(userId, session.companyId),
      data: {
        authorizationPinHash: newHash,
        pinResetRequired: false,
        pinLastChangedAt: new Date(),
      },
    });

    await writeLegacyActivityLog({
      companyId: session.companyId,
      userId: session.userId, // whoever performed the action
      action: 'UPDATE',
      module: 'USUARIOS',
      recordId: userId,
      details: `Alterou o próprio PIN de autorização.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao alterar o PIN de autorização.' };
  }
}
