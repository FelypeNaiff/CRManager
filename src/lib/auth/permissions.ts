import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getActiveProfileSession, ActiveProfileSession } from './actions';
import { writeActivityLog } from './activity-log';
import { PermissionModule, PermissionAction } from './permission-catalog';

export type SystemModule = PermissionModule;
export type SystemAction = PermissionAction;

export async function getUserPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: { permissions: true },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE' || !user.permitirAcesso) return [];
  return user.role?.permissions || [];
}

export async function checkUserPermission(
  userId: string,
  module: SystemModule,
  action: SystemAction
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: {
            where: { module, action },
          },
        },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE' || !user.permitirAcesso || user.role?.status !== 'ACTIVE') return false;
  if (user.role?.isAdmin) return true;

  const permission = user.role?.permissions[0];
  return permission ? permission.allowed : false;
}

export function can(session: ActiveProfileSession | null, module: SystemModule, action: SystemAction): boolean {
  if (!session) return false;
  if (session.isAdmin) return true;

  if (!session.permissions) return false;
  const key = `${module}:${action}`;
  return !!session.permissions[key];
}

export async function requireAuth(): Promise<ActiveProfileSession> {
  const session = await getActiveProfileSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function requireAdmin(): Promise<ActiveProfileSession> {
  const session = await requireAuth();
  if (!session.isAdmin) {
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'SISTEMA' as any, // Not real module, just log
      recordId: session.userId,
      details: 'Tentativa bloqueada por proteção administrativa.',
    });
    throw new Error('Acesso negado. Apenas administradores podem realizar esta ação.');
  }
  return session;
}

export async function requirePermission(
  module: SystemModule,
  action: SystemAction
): Promise<ActiveProfileSession> {
  const session = await requireAuth();

  const hasPerm = await checkUserPermission(session.userId, module, action);

  if (!hasPerm) {
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'SISTEMA' as any,
      recordId: session.userId,
      details: `Tentativa bloqueada por falta de permissão: ${module}.${action}`,
    });
    throw new Error(`Acesso negado: Você não possui a permissão ${module}.${action}.`);
  }

  return session;
}

export async function requireAnyPermission(
  permissions: { module: SystemModule; action: SystemAction }[]
): Promise<ActiveProfileSession> {
  const session = await requireAuth();

  for (const p of permissions) {
    const hasPerm = await checkUserPermission(session.userId, p.module, p.action);
    if (hasPerm) return session;
  }

  throw new Error(`Acesso negado: Nenhuma permissão válida encontrada.`);
}

export async function requireAllPermissions(
  permissions: { module: SystemModule; action: SystemAction }[]
): Promise<ActiveProfileSession> {
  const session = await requireAuth();

  for (const p of permissions) {
    const hasPerm = await checkUserPermission(session.userId, p.module, p.action);
    if (!hasPerm) {
      throw new Error(`Acesso negado: Falta a permissão ${p.module}.${p.action}.`);
    }
  }

  return session;
}

export async function getCurrentUserPermissions(): Promise<any[]> {
  const session = await requireAuth();
  return getUserPermissions(session.userId);
}

export async function getCurrentUserContext(): Promise<ActiveProfileSession> {
  return requireAuth();
}
