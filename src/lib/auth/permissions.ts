import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getActiveProfileSession, ActiveProfileSession } from './actions';
import { writeActivityLog } from './activity-log';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermissionAction =
  | 'visualizar'
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'acessar'
  | 'exportar'
  | 'imprimir';

export type SystemModule =
  | 'Vendas'
  | 'PDV'
  | 'Caixa'
  | 'Clientes'
  | 'Filhos'
  | 'Produtos'
  | 'Estoque'
  | 'Compras'
  | 'Financeiro'
  | 'Contas a pagar'
  | 'Contas a receber'
  | 'Fornecedores'
  | 'Orçamentos'
  | 'Trocas'
  | 'Devoluções'
  | 'CRM'
  | 'Relatórios'
  | 'Usuários'
  | 'Permissões'
  | 'Grupos usuários'
  | 'Configurações gerais'
  | 'Configurações PDV'
  | 'Logs'
  | 'Sistema'
  | 'Categorias'
  | 'Marcas'
  | 'Auth'
  | string;

// ─── Core DB Helpers ──────────────────────────────────────────────────────────

/**
 * Returns all permissions for a user's role from the database.
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

/**
 * Low-level: checks a specific permission against the database.
 * For admin roles, always returns true.
 */
export async function checkUserPermission(
  userId: string,
  module: SystemModule,
  action: PermissionAction
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

  if (!user || user.status !== 'ACTIVE' || !user.permitirAcesso) return false;
  if (user.role?.isAdmin) return true;

  const permission = user.role?.permissions[0];
  return permission ? permission.allowed : false;
}

// ─── Fluent Helpers (can / hasRole) ───────────────────────────────────────────

/**
 * Checks a permission using the session stored in the cookie (fast, no extra DB call).
 *
 * @example
 * const allowed = await can('Vendas', 'visualizar');
 */
export async function can(
  module: SystemModule,
  action: PermissionAction
): Promise<boolean> {
  const session = await getActiveProfileSession();
  if (!session) return false;
  if (session.isAdmin) return true;
  return !!session.permissions[`${module}:${action}`];
}

/**
 * Checks whether the active session has a specific cargo/role name.
 *
 * @example
 * const isAdmin = await hasRole('Administrador');
 */
export async function hasRole(roleName: string): Promise<boolean> {
  const session = await getActiveProfileSession();
  if (!session) return false;
  if (session.isAdmin) return roleName === 'Administrador' || roleName === 'admin';
  return session.role?.toLowerCase() === roleName.toLowerCase();
}

/**
 * Checks whether the active session is an admin root.
 */
export async function isAdminSession(): Promise<boolean> {
  const session = await getActiveProfileSession();
  return !!session?.isAdmin;
}

// ─── Route Guard ──────────────────────────────────────────────────────────────

/**
 * Server-side route authorization using the database.
 */
export async function canUserAccessRoute(userId: string, pathname: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || user.status !== 'ACTIVE' || !user.permitirAcesso) return false;
  if (user.role?.isAdmin) return true;

  if (pathname === '/' || pathname.startsWith('/dashboard')) return true;
  if (pathname.startsWith('/inbox') || pathname.startsWith('/agenda')) return true;
  if (pathname.startsWith('/selecionar-perfil')) return true;

  if (pathname.startsWith('/configuracoes/usuarios')) return checkUserPermission(userId, 'Usuários', 'visualizar');
  if (pathname.startsWith('/configuracoes/grupos-usuarios')) return checkUserPermission(userId, 'Grupos usuários', 'visualizar');
  if (pathname.startsWith('/configuracoes/permissoes')) return checkUserPermission(userId, 'Permissões', 'visualizar');
  if (pathname.startsWith('/configuracoes/gerais')) return checkUserPermission(userId, 'Configurações gerais', 'visualizar');
  if (pathname.startsWith('/configuracoes/pdv')) return checkUserPermission(userId, 'Configurações PDV', 'visualizar');
  if (pathname.startsWith('/configuracoes/logs')) return checkUserPermission(userId, 'Logs', 'visualizar');
  if (pathname.startsWith('/configuracoes')) {
    return (
      (await checkUserPermission(userId, 'Configurações gerais', 'visualizar')) ||
      (await checkUserPermission(userId, 'Sistema', 'visualizar'))
    );
  }

  if (pathname.startsWith('/financeiro')) return checkUserPermission(userId, 'Financeiro', 'acessar');
  if (pathname.startsWith('/contas-a-pagar')) return checkUserPermission(userId, 'Contas a pagar', 'visualizar');
  if (pathname.startsWith('/contas-a-receber')) return checkUserPermission(userId, 'Contas a receber', 'visualizar');

  if (pathname.startsWith('/produtos')) return checkUserPermission(userId, 'Produtos', 'visualizar');
  if (pathname.startsWith('/estoque')) return checkUserPermission(userId, 'Estoque', 'visualizar');
  if (pathname.startsWith('/categorias')) return checkUserPermission(userId, 'Categorias', 'visualizar');
  if (pathname.startsWith('/marcas')) return checkUserPermission(userId, 'Marcas', 'visualizar');
  if (pathname.startsWith('/compras')) return checkUserPermission(userId, 'Compras', 'visualizar');

  if (pathname.startsWith('/fornecedores')) return checkUserPermission(userId, 'Fornecedores', 'visualizar');
  if (pathname.startsWith('/clientes')) return checkUserPermission(userId, 'Clientes', 'visualizar');
  if (pathname.startsWith('/filhos')) return checkUserPermission(userId, 'Filhos', 'visualizar');

  if (pathname.startsWith('/pdv')) return checkUserPermission(userId, 'PDV', 'visualizar');
  if (pathname.startsWith('/caixa')) return checkUserPermission(userId, 'Caixa', 'visualizar');
  if (pathname.startsWith('/vendas')) return checkUserPermission(userId, 'Vendas', 'visualizar');
  if (pathname.startsWith('/orcamentos')) return checkUserPermission(userId, 'Orçamentos', 'visualizar');
  if (pathname.startsWith('/trocas')) return checkUserPermission(userId, 'Trocas', 'visualizar');
  if (pathname.startsWith('/devolucoes')) return checkUserPermission(userId, 'Devoluções', 'visualizar');

  if (pathname.startsWith('/relatorios')) return checkUserPermission(userId, 'Relatórios', 'visualizar');
  if (pathname.startsWith('/crm')) return checkUserPermission(userId, 'CRM', 'visualizar');

  return false;
}

// ─── Enforcement (Server Components / Server Actions) ─────────────────────────

/**
 * Enforces that the active session has a specific permission.
 * Redirects to /login if unauthenticated, or /selecionar-perfil?error=unauthorized if denied.
 * Logs access denials to activity_logs.
 *
 * @example
 * // In a Server Component or Server Action:
 * const session = await requirePermission('Financeiro', 'acessar');
 */
export async function requirePermission(
  module: SystemModule,
  action: PermissionAction
): Promise<ActiveProfileSession> {
  const session = await getActiveProfileSession();

  if (!session) {
    if (process.env.TEST_MODE === 'true') {
      throw new Error('TEST_REDIRECT_TO:/login');
    }
    redirect('/login');
  }

  const hasPerm = session.isAdmin || !!session.permissions[`${module}:${action}`];

  if (!hasPerm) {
    // Log the denied access attempt
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'ACESSO_NEGADO',
      module,
      details: `Perfil "${session.name}" tentou acessar ${module}:${action} sem permissão.`,
    });
    if (process.env.TEST_MODE === 'true') {
      throw new Error('TEST_REDIRECT_TO:/selecionar-perfil?error=unauthorized');
    }
    redirect('/selecionar-perfil?error=unauthorized');
  }

  return session;
}

/**
 * Enforces that the active session is authenticated (any profile).
 * Redirects to /login if there's no active session.
 */
export async function requireAuth(): Promise<ActiveProfileSession> {
  const session = await getActiveProfileSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

/**
 * Enforces that the active session is an admin.
 * Redirects to /selecionar-perfil?error=unauthorized if not admin.
 */
export async function requireAdmin(): Promise<ActiveProfileSession> {
  const session = await getActiveProfileSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) {
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'ACESSO_NEGADO',
      module: 'Admin',
      details: `Perfil "${session.name}" tentou acessar área restrita de administradores.`,
    });
    redirect('/selecionar-perfil?error=unauthorized');
  }
  return session;
}
