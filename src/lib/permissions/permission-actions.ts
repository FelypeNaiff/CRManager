'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { PERMISSION_CATALOG, TEMPLATES, ADMIN_TEMPLATE, PermissionModule, PermissionAction } from '@/lib/auth/permission-catalog';
import { tenantRolePermissionWhere } from '@/lib/auth/admin-tenant-security';
import { normalizePermissionMatrix } from './permission-matrix';

export async function getPermissionCatalogAction() {
  await requirePermission('GRUPOS_USUARIOS', 'VIEW');
  return { success: true, data: serializePrisma(PERMISSION_CATALOG) };
}

export async function getRolePermissionsAction(roleId: string) {
  const session = await requirePermission('GRUPOS_USUARIOS', 'VIEW');
  
  try {
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId: session.companyId },
      include: { permissions: true }
    });

    if (!role) {
      return { success: false, error: 'Grupo não encontrado.' };
    }
    return { success: true, data: { role, permissions: role.permissions } };
  } catch (error: any) {
    return { success: false, error: 'Erro ao buscar permissões.' };
  }
}

export async function updateRolePermissionsAction(roleId: string, permissions: { module: string, action: string, allowed: boolean }[]) {
  const session = await requirePermission('GRUPOS_USUARIOS', 'UPDATE');

  try {
    const allowedPermissions = normalizePermissionMatrix(permissions);
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId: session.companyId }
    });

    if (!role) {
      return { success: false, error: 'Grupo não encontrado.' };
    }
    if (role.isAdmin && !session.isAdmin) {
      return { success: false, error: 'Apenas administradores podem alterar permissões de grupos administrativos.' };
    }

    if (role.isAdmin) {
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.permission.deleteMany({
        where: tenantRolePermissionWhere(roleId, session.companyId)
      });

      if (allowedPermissions.length > 0) {
        await tx.permission.createMany({
          data: allowedPermissions.map(permission => ({ roleId, ...permission }))
        });
      }

      await tx.activityLog.create({
        data: {
          companyId: session.companyId,
          userId: session.userId,
          action: 'UPDATE',
          module: 'PERMISSOES',
          recordId: roleId,
          details: `Permissões do grupo ${role.name} atualizadas (Matriz salva).`,
        },
      });
    });

    return { success: true };
  } catch (error: any) {
    if (error instanceof Error && error.message === 'INVALID_PERMISSION_MATRIX') {
      return { success: false, error: 'Matriz de permissões inválida.' };
    }
    return { success: false, error: 'Erro ao atualizar permissões.' };
  }
}

export async function applyTemplateAction(roleId: string, templateKey: string) {
  const session = await requirePermission('GRUPOS_USUARIOS', 'UPDATE');

  try {
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId: session.companyId }
    });

    if (!role) {
      return { success: false, error: 'Grupo não encontrado.' };
    }
    if (role.isAdmin && !session.isAdmin) {
      return { success: false, error: 'Apenas administradores podem alterar permissões de grupos administrativos.' };
    }
    if (role.isAdmin) {
      return { success: true };
    }

    let templatePermissions: { module: string, action: string, allowed: boolean }[] = [];
    
    if (templateKey === 'ADMIN') {
      templatePermissions = ADMIN_TEMPLATE.map(p => ({ ...p, allowed: true }));
    } else if (TEMPLATES[templateKey]) {
      templatePermissions = TEMPLATES[templateKey].map(p => ({ ...p, allowed: true }));
    } else {
      return { success: false, error: 'Template não encontrado.' };
    }

    const allowedPermissions = normalizePermissionMatrix(templatePermissions);

    await prisma.$transaction(async (tx) => {
      await tx.permission.deleteMany({
        where: tenantRolePermissionWhere(roleId, session.companyId)
      });

      const dataToInsert = allowedPermissions.map(p => ({
        roleId,
        module: p.module,
        action: p.action,
        allowed: true
      }));

      if (dataToInsert.length > 0) {
        await tx.permission.createMany({
          data: dataToInsert
        });
      }

      await tx.activityLog.create({
        data: {
          companyId: session.companyId,
          userId: session.userId,
          action: 'UPDATE',
          module: 'PERMISSOES',
          recordId: roleId,
          details: `Template ${templateKey} aplicado ao grupo ${role.name}.`,
        },
      });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao aplicar template.' };
  }
}
