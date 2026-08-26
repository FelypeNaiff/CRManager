import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  getProfileSessionSecret,
  PROFILE_SESSION_COOKIE,
  ProfileSelectorError,
  verifyProfileSelector,
} from './profile-selector';

export type ServerPermissionMap = Readonly<Record<string, true>>;

/**
 * Trusted authentication and authorization context for server-side code.
 * Every field is derived from a validated Supabase identity and fresh Prisma
 * records. Client payloads, localStorage and the legacy profile cookie are not
 * inputs to this context.
 */
export interface ServerAuthContext {
  authUserId: string;
  userId: string;
  companyId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isAdmin: boolean;
  permissions: ServerPermissionMap;
}

export type ServerAuthErrorCode =
  | 'UNAUTHENTICATED'
  | 'NEEX_USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'ACCESS_NOT_ALLOWED'
  | 'INVALID_CONTEXT';

const SAFE_AUTH_MESSAGES: Record<ServerAuthErrorCode, string> = {
  UNAUTHENTICATED: 'Autenticação necessária.',
  NEEX_USER_NOT_FOUND: 'Usuário não autorizado para acessar o NEEX.',
  USER_INACTIVE: 'Usuário inativo ou bloqueado.',
  ACCESS_NOT_ALLOWED: 'Acesso não permitido.',
  INVALID_CONTEXT: 'Não foi possível validar o contexto de acesso.',
};

export class ServerAuthError extends Error {
  readonly code: ServerAuthErrorCode;

  constructor(code: ServerAuthErrorCode) {
    super(SAFE_AUTH_MESSAGES[code]);
    this.name = 'ServerAuthError';
    this.code = code;
  }
}

interface AuthIdentity {
  id: string;
  email?: string | null;
  emailConfirmedAt?: string | null;
}

interface PermissionRecord {
  module: string;
  action: string;
  allowed: boolean;
}

interface NeexUserRecord {
  id: string;
  companyId: string;
  name: string;
  email: string;
  status: string;
  permitirAcesso: boolean;
  company: {
    id: string;
    status: string;
  } | null;
  role: {
    id: string;
    name: string;
    status: string;
    isAdmin: boolean;
    permissions: PermissionRecord[];
  } | null;
}

export interface ServerAuthResolverDependencies {
  getAuthenticatedIdentity(): Promise<AuthIdentity | null>;
  findNeexUserByVerifiedEmail(email: string): Promise<NeexUserRecord | null>;
}

function isActiveStatus(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'ATIVO';
}

function buildPermissionMap(permissions: PermissionRecord[]): ServerPermissionMap {
  const permissionMap: Record<string, true> = {};

  for (const permission of permissions) {
    if (permission.allowed) {
      permissionMap[`${permission.module}:${permission.action}`] = true;
    }
  }

  return Object.freeze(permissionMap);
}

/**
 * Transitional identity bridge between Supabase Auth and NEEX.
 *
 * Email is used only because the current schema has no Supabase UID column.
 * Keeping this lookup isolated allows a future immutable UID mapping without
 * changing any consumer of ServerAuthContext.
 */
async function findNeexUserForAuthIdentity(
  identity: AuthIdentity,
  dependencies: ServerAuthResolverDependencies
): Promise<NeexUserRecord> {
  const verifiedEmail = identity.email?.trim().toLowerCase();

  if (!verifiedEmail || !identity.emailConfirmedAt) {
    throw new ServerAuthError('INVALID_CONTEXT');
  }

  const user = await dependencies.findNeexUserByVerifiedEmail(verifiedEmail);
  if (!user) {
    throw new ServerAuthError('NEEX_USER_NOT_FOUND');
  }

  return user;
}

async function resolveContextFromDependencies(
  dependencies: ServerAuthResolverDependencies
): Promise<ServerAuthContext> {
  const identity = await dependencies.getAuthenticatedIdentity();
  if (!identity?.id) {
    throw new ServerAuthError('UNAUTHENTICATED');
  }

  const user = await findNeexUserForAuthIdentity(identity, dependencies);
  return buildContext(identity.id, user);
}

function buildContext(authUserId: string, user: NeexUserRecord): ServerAuthContext {

  if (!isActiveStatus(user.status)) {
    throw new ServerAuthError('USER_INACTIVE');
  }

  if (!user.permitirAcesso) {
    throw new ServerAuthError('ACCESS_NOT_ALLOWED');
  }

  if (!user.company || user.company.id !== user.companyId) {
    throw new ServerAuthError('INVALID_CONTEXT');
  }

  if (!isActiveStatus(user.company.status)) {
    throw new ServerAuthError('ACCESS_NOT_ALLOWED');
  }

  if (!user.role || !user.role.id) {
    throw new ServerAuthError('INVALID_CONTEXT');
  }

  if (!isActiveStatus(user.role.status)) {
    throw new ServerAuthError('ACCESS_NOT_ALLOWED');
  }

  return Object.freeze({
    authUserId,
    userId: user.id,
    companyId: user.company.id,
    name: user.name,
    email: user.email,
    roleId: user.role.id,
    roleName: user.role.name,
    isAdmin: user.role.isAdmin,
    permissions: buildPermissionMap(user.role.permissions),
  });
}

const userContextSelect = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  status: true,
  permitirAcesso: true,
  company: { select: { id: true, status: true } },
  role: {
    select: {
      id: true,
      name: true,
      status: true,
      isAdmin: true,
      permissions: { select: { module: true, action: true, allowed: true } },
    },
  },
} as const;

/**
 * Test-only entry point for isolated unit tests. It is fail-closed in a
 * production runtime and cannot be enabled through TEST_MODE or
 * global.mockSession. Application code must call resolveServerAuthContext().
 */
export async function resolveServerAuthContextForTesting(
  dependencies: ServerAuthResolverDependencies
): Promise<ServerAuthContext> {
  if (process.env.NODE_ENV === 'production') {
    throw new ServerAuthError('INVALID_CONTEXT');
  }

  return resolveContextFromDependencies(dependencies);
}

/**
 * Resolves the current trusted server context without cache. Supabase validates
 * identity on every call and Prisma reloads authorization immediately.
 */
export async function resolveBaseServerAuthContext(): Promise<ServerAuthContext> {
  return resolveContextFromDependencies({
    async getAuthenticatedIdentity() {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email,
        emailConfirmedAt: data.user.email_confirmed_at,
      };
    },

    async findNeexUserByVerifiedEmail(email) {
      return prisma.user.findUnique({
        where: { email },
        select: userContextSelect,
      });
    },
  });
}

export async function resolveServerAuthContext(): Promise<ServerAuthContext> {
  const baseContext = await resolveBaseServerAuthContext();

  const cookieStore = await cookies();
  const selectorToken = cookieStore.get(PROFILE_SESSION_COOKIE)?.value;
  if (!selectorToken) throw new ServerAuthError('INVALID_CONTEXT');

  try {
    const selector = verifyProfileSelector(
      selectorToken,
      getProfileSessionSecret(),
      baseContext.authUserId
    );
    const selectedUser = await prisma.user.findFirst({
      where: { id: selector.profileId, companyId: baseContext.companyId },
      select: userContextSelect,
    });
    if (!selectedUser) throw new ServerAuthError('INVALID_CONTEXT');
    return buildContext(baseContext.authUserId, selectedUser);
  } catch (error) {
    if (error instanceof ServerAuthError) throw error;
    if (error instanceof ProfileSelectorError) throw new ServerAuthError('INVALID_CONTEXT');
    throw error;
  }
}
