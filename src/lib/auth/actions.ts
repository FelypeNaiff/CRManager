'use server';
import { serializePrisma } from '@/lib/serialize';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPin } from './pin';
import { writeActivityLog } from './activity-log';

export interface ActiveProfileSession {
  userId: string;
  companyId: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  permissions: Record<string, boolean>;
}

/** Nãome do cookie de sessão do perfil ativo */
const SESSION_COOKIE = '@crmanager:activeProfileSession';

/**
 * Validates a profile PIN on the server and creates a secure session cookie if correct.
 * Records security events in activity_logs (success, failure).
 */
export async function validateProfilePin(userId: string, pin: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE' || !user.permitirAcesso) {
      return { success: false, error: 'Perfil não encontrado ou inativo.' };
    }

    const isValid = await verifyPin(pin, user.pinAccessHash);

    if (!isValid) {
      // Log PIN failure
      await writeActivityLog({
        companyId: user.companyId,
        userId: user.id,
        action: 'PIN_FALHOU',
        module: 'Auth',
        details: `Tentativa de PIN inválida para ${user.email}`,
      });
      return { success: false, error: 'Senha incorreta para este perfil.' };
    }

    // Build permission map
    const permissionsMap: Record<string, boolean> = {};
    if (user.role?.permissions) {
      user.role.permissions.forEach((p: any) => {
        if (p.allowed) {
          permissionsMap[`${p.module}:${p.action}`] = true;
        }
      });
    }

    // Set secure HTTP-only session cookie (1 day)
    const cookieStore = await cookies();
    const sessionData: ActiveProfileSession = {
      userId: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      role: user.cargo || '',
      isAdmin: user.role?.isAdmin || false,
      permissions: permissionsMap,
    };

    cookieStore.set(SESSION_COOKIE, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
      sameSite: 'lax',
    });

    // Log successful login
    await writeActivityLog({
      companyId: user.companyId,
      userId: user.id,
      action: 'LOGIN',
      module: 'Auth',
      details: `Perfil ${user.name} autenticado com sucesso.`,
    });

    return {
      success: true,
      profile: {
        id: user.id,
        nome: user.name,
        email: user.email,
        empresaId: user.companyId,
        role: user.cargo || 'operador',
        status: user.status,
        permitir_acesso: user.permitirAcesso,
        grupo_id: user.roleId,
        isAdmin: user.role?.isAdmin || false,
        permissions: permissionsMap,
      },
    };
  } catch (error) {
    console.error('Error validating profile PIN on server:', error);
    return { success: false, error: 'Erro interno do servidor ao validar o PIN.' };
  }
}

/**
 * Clears the server-side profile session cookie and logs the logout event.
 */
export async function logoutProfileSession(options?: { logEvent?: boolean }) {
  try {
    // Log the logout if session data is available
    if (options?.logEvent !== false) {
      const session = await getActiveProfileSession();
      if (session) {
        await writeActivityLog({
          companyId: session.companyId,
          userId: session.userId,
          action: 'LOGOUT',
          module: 'Auth',
          details: `Perfil ${session.name} encerrou a sessão.`,
        });
      }
    }

    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    return { success: true };
  } catch (error) {
    console.error('Error clearing profile session cookie:', error);
    return { success: false, error: 'Erro ao encerrar sessão.' };
  }
}

/**
 * Retrieves the active profile session from cookies.
 */
export async function getActiveProfileSession(): Promise<ActiveProfileSession | null> {
  if (process.env.TEST_MODE === 'true') {
    return (global as any).mockSession || null;
  }
  try {
    console.log('[getActiveProfileSession] starting...');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (!sessionCookie || !sessionCookie.value) {
      console.log('[getActiveProfileSession] no session cookie');
      return null;
    }
    const session = JSON.parse(sessionCookie.value) as ActiveProfileSession;
    console.log('[getActiveProfileSession] parsed session:', session.userId);
    return session;
  } catch (error) {
    console.error('[getActiveProfileSession] erro:', error);
    return null;
  }
}

/**
 * Retrieves all active user profiles from PostgreSQL via Prisma.
 */
export async function getAvailableProfiles() {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        permitirAcesso: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        cargo: true,
        companyId: true,
        roleId: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      profiles: users.map((u: any) => ({
        id: u.id,
        nome: u.name,
        email: u.email,
        cargo: u.cargo,
        empresa_id: u.companyId,
        grupo_id: u.roleId,
        permitir_acesso: true,
      })),
    };
  } catch (error) {
    console.error('Error fetching available profiles from Prisma:', error);
    return {
      success: false,
      error: 'Erro ao buscar perfis do banco relacional.',
      profiles: [],
    };
  }
}

/**
 * Checks if the logged-in Google email is authorized (exists in the users table).
 * Replaces the hardcoded ALLOWED_EMAILS list.
 */
export async function checkEmailIsAuthorized(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true, permitirAcesso: true },
    });
    return !!user && user.status === 'ACTIVE' && user.permitirAcesso;
  } catch (error) {
    console.error('Error checking email authorization:', error);
    return false;
  }
}
