import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = '@crmanager:activeProfileSession';

// Routes completely open (no auth required)
const PUBLIC_PATHS = [
  '/login',
  '/selecionar-perfil',
  '/setup',
  '/favicon.ico',
  '/_next',
  '/api',
];

// Routes that any authenticated profile can access
const FREE_AUTH_PATHS = ['/dashboard', '/inbox', '/agenda'];

// Route → [module, action] map for RBAC enforcement
const ROUTE_PERMISSION_MAP: Array<{
  prefix: string;
  module: string;
  action: string;
}> = [
  { prefix: '/configuracoes/usuarios',        module: 'Usuários',               action: 'visualizar' },
  { prefix: '/configuracoes/grupos-usuarios', module: 'Grupos usuários',         action: 'visualizar' },
  { prefix: '/configuracoes/permissoes',      module: 'Permissões',              action: 'visualizar' },
  { prefix: '/configuracoes/gerais',          module: 'Configurações gerais',    action: 'visualizar' },
  { prefix: '/configuracoes/pdv',             module: 'Configurações PDV',       action: 'visualizar' },
  { prefix: '/configuracoes/logs',            module: 'Logs',                    action: 'visualizar' },
  { prefix: '/financeiro',                    module: 'Financeiro',              action: 'acessar'    },
  { prefix: '/carteira-saldos',               module: 'Financeiro',              action: 'acessar'    },
  { prefix: '/contas-a-pagar',                module: 'Contas a pagar',          action: 'visualizar' },
  { prefix: '/contas-a-receber',              module: 'Contas a receber',        action: 'visualizar' },
  { prefix: '/produtos',                      module: 'Produtos',                action: 'visualizar' },
  { prefix: '/estoque',                       module: 'Estoque',                 action: 'visualizar' },
  { prefix: '/categorias',                    module: 'Categorias',              action: 'visualizar' },
  { prefix: '/marcas',                        module: 'Marcas',                  action: 'visualizar' },
  { prefix: '/compras',                       module: 'Compras',                 action: 'visualizar' },
  { prefix: '/fornecedores',                  module: 'Fornecedores',            action: 'visualizar' },
  { prefix: '/clientes',                      module: 'Clientes',                action: 'visualizar' },
  { prefix: '/aniversariantes',               module: 'Clientes',                action: 'visualizar' },
  { prefix: '/clientes-com-saldo',            module: 'Clientes',                action: 'visualizar' },
  { prefix: '/filhos',                        module: 'Filhos',                  action: 'visualizar' },
  { prefix: '/pdv',                           module: 'PDV',                     action: 'visualizar' },
  { prefix: '/caixa',                         module: 'Caixa',                   action: 'visualizar' },
  { prefix: '/vendas',                        module: 'Vendas',                  action: 'visualizar' },
  { prefix: '/orcamentos',                    module: 'Orçamentos',              action: 'visualizar' },
  { prefix: '/trocas',                        module: 'Trocas',                  action: 'visualizar' },
  { prefix: '/trocas-devolucoes',             module: 'Trocas',                  action: 'visualizar' },
  { prefix: '/devolucoes',                    module: 'Devoluções',              action: 'visualizar' },
  { prefix: '/relatorios',                    module: 'Relatórios',              action: 'visualizar' },
  { prefix: '/crm',                           module: 'CRM',                     action: 'visualizar' },
  { prefix: '/campanhas',                     module: 'CRM',                     action: 'visualizar' },
  { prefix: '/campanhas-whatsapp',            module: 'CRM',                     action: 'visualizar' },
  // Comercial module routes
  { prefix: '/comercial/vendas',              module: 'Vendas',                  action: 'visualizar' },
  { prefix: '/comercial/trocas',              module: 'Trocas',                  action: 'visualizar' },
  { prefix: '/comercial/metas',               module: 'Vendas',                  action: 'visualizar' },
  { prefix: '/comercial/comissoes',           module: 'Vendas',                  action: 'visualizar' },
  { prefix: '/comercial/relatorios',          module: 'Relatórios',              action: 'visualizar' },
  { prefix: '/comercial',                     module: 'Vendas',                  action: 'visualizar' },
  // /configuracoes is a catch-all — handled separately below
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Read session cookie early
  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  // 2. Handle public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p) || pathname === p)) {
    // se usuário autenticado acessar /login, redirecionar para /dashboard
    if (sessionCookie?.value && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 3. Read session cookie (if no session -> redirect to login)
  if (!sessionCookie?.value) {
    // No session → redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  let session: {
    userId: string;
    isAdmin: boolean;
    permissions: Record<string, boolean>;
    name: string;
  };

  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    // Corrupt cookie → force re-login
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // 3. Admins bypass all RBAC checks
  if (session.isAdmin) {
    return NextResponse.next();
  }

  // 4. Free routes for any authenticated profile
  if (FREE_AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 5. Root redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 6. Evaluate RBAC from cookie permissions map (no DB call in middleware)
  const matchedRule = ROUTE_PERMISSION_MAP.find((rule) =>
    pathname.startsWith(rule.prefix)
  );

  if (matchedRule) {
    const key = `${matchedRule.module}:${matchedRule.action}`;
    const hasPermission = !!session.permissions[key];

    if (!hasPermission) {
      const deniedUrl = new URL('/selecionar-perfil', request.url);
      deniedUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(deniedUrl);
    }

    return NextResponse.next();
  }

  // 7. /configuracoes catch-all
  if (pathname.startsWith('/configuracoes')) {
    const hasGerais = !!session.permissions['Configurações gerais:visualizar'];
    const hasSistema = !!session.permissions['Sistema:visualizar'];
    const hasUsuarios = !!session.permissions['Usuários:visualizar'];

    if (hasGerais || hasSistema || hasUsuarios) {
      return NextResponse.next();
    }

    const deniedUrl = new URL('/selecionar-perfil', request.url);
    deniedUrl.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(deniedUrl);
  }

  // 8. Unmapped protected routes — deny by default
  const deniedUrl = new URL('/selecionar-perfil', request.url);
  deniedUrl.searchParams.set('error', 'unauthorized');
  return NextResponse.redirect(deniedUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
