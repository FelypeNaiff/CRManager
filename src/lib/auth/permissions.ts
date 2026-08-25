import { prisma } from '@/lib/prisma';
import { writeActivityLog } from './activity-log';
import type { ActiveProfileSession } from './actions';
import { PermissionModule, PermissionAction } from './permission-catalog';
import {
  resolveServerAuthContext,
  ServerAuthError,
  type ServerAuthContext,
} from './server-auth-context';

export type SystemModule = PermissionModule;
export type SystemAction = PermissionAction;

type ResolveAuthContext = () => Promise<ServerAuthContext>;
type DeniedAuthorizationAudit = (
  context: ServerAuthContext,
  details: string
) => Promise<void>;

interface AuthorizationHelpers {
  requireAuth(): Promise<ServerAuthContext>;
  requireAdmin(): Promise<ServerAuthContext>;
  requirePermission(module: SystemModule, action: SystemAction): Promise<ServerAuthContext>;
  requireAnyPermission(
    permissions: { module: SystemModule; action: SystemAction }[]
  ): Promise<ServerAuthContext>;
  requireAllPermissions(
    permissions: { module: SystemModule; action: SystemAction }[]
  ): Promise<ServerAuthContext>;
}

function hasServerPermission(
  context: ServerAuthContext,
  module: SystemModule,
  action: SystemAction
): boolean {
  if (context.isAdmin) return true;
  return context.permissions[`${module}:${action}`] === true;
}

function createAuthorizationHelpers(
  resolveContext: ResolveAuthContext,
  auditDenied: DeniedAuthorizationAudit
): AuthorizationHelpers {
  async function requireAuth(): Promise<ServerAuthContext> {
    return resolveContext();
  }

  async function deny(
    context: ServerAuthContext,
    details: string
  ): Promise<never> {
    await auditDenied(context, details);
    throw new ServerAuthError('ACCESS_NOT_ALLOWED');
  }

  return {
    requireAuth,

    async requireAdmin() {
      const context = await requireAuth();
      if (!context.isAdmin) {
        return deny(context, 'Tentativa bloqueada por proteção administrativa.');
      }
      return context;
    },

    async requirePermission(module, action) {
      const context = await requireAuth();
      if (!hasServerPermission(context, module, action)) {
        return deny(
          context,
          `Tentativa bloqueada por falta de permissão: ${module}.${action}`
        );
      }
      return context;
    },

    async requireAnyPermission(permissions) {
      const context = await requireAuth();
      if (!permissions.some(({ module, action }) => hasServerPermission(context, module, action))) {
        return deny(context, 'Tentativa bloqueada: nenhuma permissão requerida foi encontrada.');
      }
      return context;
    },

    async requireAllPermissions(permissions) {
      const context = await requireAuth();
      if (!permissions.every(({ module, action }) => hasServerPermission(context, module, action))) {
        return deny(context, 'Tentativa bloqueada: nem todas as permissões requeridas foram encontradas.');
      }
      return context;
    },
  };
}

async function writeDeniedAuthorizationAudit(
  context: ServerAuthContext,
  details: string
): Promise<void> {
  await writeActivityLog({
    companyId: context.companyId,
    userId: context.userId,
    action: 'UPDATE',
    module: 'SISTEMA' as any,
    recordId: context.userId,
    details,
  });
}

const serverAuthorization = createAuthorizationHelpers(
  resolveServerAuthContext,
  writeDeniedAuthorizationAudit
);

/** Resolves a fresh, server-validated Supabase + Prisma context. */
export async function requireAuth(): Promise<ServerAuthContext> {
  return serverAuthorization.requireAuth();
}

/** Authorizes only Role.isAdmin loaded by the trusted server resolver. */
export async function requireAdmin(): Promise<ServerAuthContext> {
  return serverAuthorization.requireAdmin();
}

/** Authorizes against the fresh Prisma permission map in ServerAuthContext. */
export async function requirePermission(
  module: SystemModule,
  action: SystemAction
): Promise<ServerAuthContext> {
  return serverAuthorization.requirePermission(module, action);
}

export async function requireAnyPermission(
  permissions: { module: SystemModule; action: SystemAction }[]
): Promise<ServerAuthContext> {
  return serverAuthorization.requireAnyPermission(permissions);
}

export async function requireAllPermissions(
  permissions: { module: SystemModule; action: SystemAction }[]
): Promise<ServerAuthContext> {
  return serverAuthorization.requireAllPermissions(permissions);
}

/**
 * Test-only factory. It never reads cookies, TEST_MODE or global.mockSession,
 * performs no audit writes, and is fail-closed in production.
 */
export function createAuthorizationHelpersForTesting(
  resolveContext: ResolveAuthContext
): AuthorizationHelpers {
  if (process.env.NODE_ENV === 'production') {
    throw new ServerAuthError('INVALID_CONTEXT');
  }

  return createAuthorizationHelpers(resolveContext, async () => {});
}

/**
 * LEGACY client/UI helper. Its input is untrusted and it must never protect a
 * Server Action, route handler or data mutation.
 */
export function can(
  session: ActiveProfileSession | null,
  module: SystemModule,
  action: SystemAction
): boolean {
  if (!session) return false;
  if (session.isAdmin) return true;
  return session.permissions?.[`${module}:${action}`] === true;
}

/**
 * Direct database lookup retained for compatibility. Authorization helpers do
 * not use this function; they use the already validated ServerAuthContext.
 */
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

/** @deprecated Prefer requirePermission(), which resolves trusted identity. */
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

  if (
    !user ||
    user.status !== 'ACTIVE' ||
    !user.permitirAcesso ||
    user.role?.status !== 'ACTIVE'
  ) {
    return false;
  }

  if (user.role?.isAdmin) return true;
  return user.role?.permissions[0]?.allowed === true;
}

export async function getCurrentUserPermissions() {
  const context = await requireAuth();
  return context.permissions;
}

export async function getCurrentUserContext(): Promise<ServerAuthContext> {
  return requireAuth();
}
