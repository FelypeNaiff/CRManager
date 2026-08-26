'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPin } from './pin';
import { writeActivityLog } from './activity-log';
import {
  resolveBaseServerAuthContext,
  resolveServerAuthContext,
  ServerAuthContext,
  ServerAuthError,
} from './server-auth-context';
import {
  createProfileSelector,
  getProfileSessionSecret,
  PROFILE_SELECTOR_MAX_AGE_SECONDS,
  PROFILE_SESSION_COOKIE,
} from './profile-selector';
import { performServerLogout } from './session-logout';

export interface ActiveProfileSession {
  userId: string;
  companyId: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  permissions: Readonly<Record<string, true>>;
}

interface SelectableProfileRecord {
  id: string;
  companyId: string;
  name: string;
  email: string;
  cargo: string | null;
  roleId: string | null;
  status: string;
  permitirAcesso: boolean;
  pinAccessHash: string;
}

interface ProfileSelectionDependencies {
  resolveBaseContext(): Promise<ServerAuthContext>;
  listProfiles(companyId: string): Promise<SelectableProfileRecord[]>;
  findProfile(profileId: string, companyId: string): Promise<SelectableProfileRecord | null>;
  verifyPinValue(pin: string, hash: string): Promise<boolean>;
  issueSelector(profileId: string, authUserId: string): string;
}

function safeSelectionError(error: unknown): string {
  if (error instanceof ServerAuthError) return error.message;
  return 'Não foi possível validar o perfil.';
}

function createProfileSelectionService(dependencies: ProfileSelectionDependencies) {
  return {
    async getAvailableProfiles() {
      try {
        const base = await dependencies.resolveBaseContext();
        const users = await dependencies.listProfiles(base.companyId);
        return {
          success: true as const,
          profiles: users.map((user) => ({
            id: user.id,
            nome: user.name,
            email: user.email,
            cargo: user.cargo,
            grupo_id: user.roleId,
            permitir_acesso: true,
          })),
        };
      } catch (error) {
        return { success: false as const, error: safeSelectionError(error), profiles: [] };
      }
    },

    async validateProfilePin(profileId: string, pin: string) {
      try {
        const base = await dependencies.resolveBaseContext();
        const user = await dependencies.findProfile(profileId, base.companyId);
        if (!user || user.status !== 'ACTIVE' || !user.permitirAcesso) {
          return { success: false as const, error: 'Perfil não encontrado ou inativo.' };
        }
        if (!(await dependencies.verifyPinValue(pin, user.pinAccessHash))) {
          return { success: false as const, error: 'Senha incorreta para este perfil.' };
        }

        return {
          success: true as const,
          selector: dependencies.issueSelector(user.id, base.authUserId),
          profile: {
            id: user.id,
            nome: user.name,
            email: user.email,
            cargo: user.cargo,
            status: user.status,
            permitir_acesso: user.permitirAcesso,
            grupo_id: user.roleId,
          },
        };
      } catch (error) {
        return { success: false as const, error: safeSelectionError(error) };
      }
    },
  };
}

const productionSelectionService = createProfileSelectionService({
  resolveBaseContext: resolveBaseServerAuthContext,
  listProfiles(companyId) {
    return prisma.user.findMany({
      where: { companyId, status: 'ACTIVE', permitirAcesso: true },
      select: {
        id: true, companyId: true, name: true, email: true, cargo: true,
        roleId: true, status: true, permitirAcesso: true, pinAccessHash: true,
      },
      orderBy: { name: 'asc' },
    });
  },
  findProfile(profileId, companyId) {
    return prisma.user.findFirst({
      where: { id: profileId, companyId },
      select: {
        id: true, companyId: true, name: true, email: true, cargo: true,
        roleId: true, status: true, permitirAcesso: true, pinAccessHash: true,
      },
    });
  },
  verifyPinValue: verifyPin,
  issueSelector(profileId, authUserId) {
    return createProfileSelector({ profileId, authUserId }, getProfileSessionSecret());
  },
});

/** Test-only dependency injection. It is unavailable in production. */
export async function createProfileSelectionServiceForTesting(
  dependencies: ProfileSelectionDependencies
) {
  if (process.env.NODE_ENV === 'production') throw new ServerAuthError('INVALID_CONTEXT');
  return createProfileSelectionService(dependencies);
}

export async function getAvailableProfiles() {
  return productionSelectionService.getAvailableProfiles();
}

export async function validateProfilePin(profileId: string, pin: string) {
  const result = await productionSelectionService.validateProfilePin(profileId, pin);
  if (!result.success) return result;

  const cookieStore = await cookies();
  cookieStore.set(PROFILE_SESSION_COOKIE, result.selector, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: PROFILE_SELECTOR_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
  });

  await writeActivityLog({
    companyId: (await resolveBaseServerAuthContext()).companyId,
    userId: result.profile.id,
    action: 'LOGIN',
    module: 'Auth',
    details: 'Perfil operacional selecionado.',
  });

  return { success: true as const, profile: result.profile };
}

/** Clears only the profile selector. Supabase logout is handled separately. */
export async function logoutProfileSession(options?: { logEvent?: boolean }) {
  try {
    if (options?.logEvent !== false) {
      const session = await getActiveProfileSession();
      if (session) {
        await writeActivityLog({
          companyId: session.companyId,
          userId: session.userId,
          action: 'LOGOUT',
          module: 'Auth',
          details: 'Perfil operacional encerrado.',
        });
      }
    }
    (await cookies()).delete(PROFILE_SESSION_COOKIE);
    return { success: true as const };
  } catch {
    return { success: false as const, error: 'Erro ao encerrar sessão.' };
  }
}

/** Unified logout: ends Supabase Auth and clears the profile selector. */
export async function logoutSession() {
  return performServerLogout();
}

/**
 * Compatibility projection for legacy consumers. The cookie is never parsed as
 * authority: Supabase, its HMAC selector and Prisma are revalidated first.
 */
export async function getActiveProfileSession(): Promise<ActiveProfileSession | null> {
  const cookieStore = await cookies();
  if (!cookieStore.get(PROFILE_SESSION_COOKIE)?.value) return null;
  try {
    const context = await resolveServerAuthContext();
    return {
      userId: context.userId,
      companyId: context.companyId,
      name: context.name,
      email: context.email,
      role: context.roleName,
      isAdmin: context.isAdmin,
      permissions: context.permissions,
    };
  } catch {
    return null;
  }
}

/** Transitional lookup retained for the current login UI. */
export async function checkEmailIsAuthorized(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true, permitirAcesso: true },
    });
    return !!user && user.status === 'ACTIVE' && user.permitirAcesso;
  } catch {
    return false;
  }
}
