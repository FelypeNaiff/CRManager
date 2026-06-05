'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { PERMISSION_CATALOG, TEMPLATES, ADMIN_TEMPLATE, PermissionModule, PermissionAction } from '@/lib/auth/permission-catalog';

export async function getPermissionCatalogAction() {
  const session = await requirePermission('PERMISSOES', 'VIEW');
  return { success: true, data: serializePrisma(PERMISSION_CATALOG) };
}

export async function getRolePermissionsAction(roleId: string) {
  const session = await requirePermission('PERMISSOES', 'VIEW');
  
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
    console.error('Error fetching role permissions:', error);
    return { success: false, error: 'Erro ao buscar permissões.' };
  }
}

/**
 * Helper to ensure we don't break the system by removing critical admin permissions
 * from the last admin role.
 */
async function ensureAdminPermissionsProtection(companyId: string, roleId: string, incomingPermissions: { module: string, action: string, allowed: boolean }[]) {
  // Find all ACTIVE admin roles
  const activeAdminRoles = await prisma.role.findMany({
    where: { companyId, isAdmin: true, status: 'ACTIVE' }
  });

  const isCurrentRoleActiveAdmin = activeAdminRoles.some(r => r.id === roleId);

  if (isCurrentRoleActiveAdmin && activeAdminRoles.length === 1) {
    // This is the last active admin role.
    // We must ensure it doesn't lose critical permissions.
    const criticalPermissions = [
      { module: 'PERMISSOES', action: 'UPDATE' },
      { module: 'USUARIOS', action: 'UPDATE' },
      { module: 'GRUPOS_USUARIOS', action: 'UPDATE' },
      { module: 'CONFIGURACOES', action: 'VIEW' }
    ];

    for (const cp of criticalPermissions) {
      const isAllowed = incomingPermissions.some(p => p.module === cp.module && p.action === cp.action && p.allowed);
      if (!isAllowed) {
        throw new Error(`Proteção de Segurança: Não é possível remover a permissão ${cp.module}.${cp.action} do único grupo de Administrador ativo no sistema.`);
      }
    }
  }
}

export async function updateRolePermissionsAction(roleId: string, permissions: { module: string, action: string, allowed: boolean }[]) {
  const session = await requirePermission('PERMISSOES', 'UPDATE');

  try {
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId: session.companyId }
    });

    if (!role) {
      return { success: false, error: 'Grupo não encontrado.' };
    }

    await ensureAdminPermissionsProtection(session.companyId, roleId, permissions);

    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing permissions for this role
      await tx.permission.deleteMany({
        where: { roleId }
      });

      // 2. Insert the new ones that are allowed
      const allowedPermissions = permissions.filter(p => p.allowed).map(p => ({
        roleId,
        module: p.module,
        action: p.action,
        allowed: true
      }));

      if (allowedPermissions.length > 0) {
        await tx.permission.createMany({
          data: allowedPermissions
        });
      }

      await writeActivityLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'UPDATE',
        module: 'PERMISSOES',
        recordId: roleId,
        details: `Permissões do grupo ${role.name} atualizadas (Matriz salva).`,
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating permissions:', error);
    return { success: false, error: error.message || 'Erro ao atualizar permissões.' };
  }
}

export async function applyTemplateAction(roleId: string, templateKey: string) {
  const session = await requirePermission('PERMISSOES', 'UPDATE');

  try {
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId: session.companyId }
    });

    if (!role) {
      return { success: false, error: 'Grupo não encontrado.' };
    }

    let templatePermissions: { module: string, action: string, allowed: boolean }[] = [];
    
    if (templateKey === 'ADMIN') {
      templatePermissions = ADMIN_TEMPLATE.map(p => ({ ...p, allowed: true }));
    } else if (TEMPLATES[templateKey]) {
      templatePermissions = TEMPLATES[templateKey].map(p => ({ ...p, allowed: true }));
    } else {
      return { success: false, error: 'Template não encontrado.' };
    }

    await ensureAdminPermissionsProtection(session.companyId, roleId, templatePermissions);

    await prisma.$transaction(async (tx) => {
      await tx.permission.deleteMany({
        where: { roleId }
      });

      const dataToInsert = templatePermissions.map(p => ({
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

      await writeActivityLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'UPDATE',
        module: 'PERMISSOES',
        recordId: roleId,
        details: `Template ${templateKey} aplicado ao grupo ${role.name}.`,
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error applying template:', error);
    return { success: false, error: error.message || 'Erro ao aplicar template.' };
  }
}
