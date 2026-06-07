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
  // Segurança / Configurações
  { prefix: '/configuracoes/usuarios',        module: 'USUARIOS',               action: 'VIEW' },
  { prefix: '/configuracoes/grupos-usuarios', module: 'GRUPOS_USUARIOS',         action: 'VIEW' },
  { prefix: '/configuracoes/permissoes',      module: 'PERMISSOES',              action: 'VIEW' },
  { prefix: '/configuracoes/empresa',         module: 'CONFIGURACOES_EMPRESA',    action: 'VIEW' },
  { prefix: '/configuracoes/dados-empresa',   module: 'CONFIGURACOES_EMPRESA',    action: 'VIEW' },
  { prefix: '/configuracoes/minha-empresa',   module: 'CONFIGURACOES_EMPRESA',    action: 'VIEW' },
  { prefix: '/configuracoes/configuracoes-operacionais', module: 'CONFIGURACOES_OPERACIONAIS', action: 'VIEW' },
  { prefix: '/configuracoes/logs',            module: 'LOGS',                    action: 'VIEW' },

  // Financeiro
  { prefix: '/financeiro',                    module: 'FINANCEIRO',              action: 'VIEW' },
  { prefix: '/carteira-saldos',               module: 'FINANCEIRO',              action: 'VIEW' },
  { prefix: '/contas-a-pagar',                module: 'FINANCEIRO',          action: 'VIEW' },
  { prefix: '/contas-a-receber',              module: 'FINANCEIRO',        action: 'VIEW' },

  // Estoque & Produtos
  { prefix: '/produtos',                      module: 'PRODUTOS',                action: 'VIEW' },
  { prefix: '/estoque',                       module: 'ESTOQUE',                 action: 'VIEW' },
  { prefix: '/movimentacoes',                 module: 'ESTOQUE',                 action: 'VIEW' },

  // CRM
  { prefix: '/clientes',                      module: 'CLIENTES',                action: 'VIEW' },
  { prefix: '/aniversariantes',               module: 'CLIENTES',                action: 'VIEW' },
  { prefix: '/clientes-com-saldo',            module: 'CLIENTES',                action: 'VIEW' },
  { prefix: '/filhos',                        module: 'FILHOS',                  action: 'VIEW' },
  { prefix: '/crm/carteira',                  module: 'CARTEIRA',                action: 'VIEW' },
  { prefix: '/wallet',                        module: 'CARTEIRA',                action: 'VIEW' },
  { prefix: '/crm',                           module: 'CRM',                     action: 'VIEW' },

  // Vendas / PDV
  { prefix: '/pdv',                           module: 'PDV',                     action: 'VIEW' },
  { prefix: '/caixa',                         module: 'CAIXA',                   action: 'VIEW' },
  { prefix: '/financeiro/caixas',             module: 'CAIXA',                   action: 'VIEW' },
  { prefix: '/vendas',                        module: 'VENDAS',                  action: 'VIEW' },
  { prefix: '/comercial/vendas',              module: 'VENDAS',                  action: 'VIEW' },
  
  // Trocas & Devoluções
  { prefix: '/trocas',                        module: 'TROCAS',                  action: 'VIEW' },
  { prefix: '/comercial/trocas',              module: 'TROCAS',                  action: 'VIEW' },
  { prefix: '/devolucoes',                    module: 'DEVOLUCOES',              action: 'VIEW' },
  { prefix: '/returns',                       module: 'DEVOLUCOES',              action: 'VIEW' },
  { prefix: '/vendas/devolucoes',             module: 'DEVOLUCOES',              action: 'VIEW' },

  // Relatórios
  { prefix: '/relatorios',                    module: 'RELATORIOS',              action: 'VIEW' },
  { prefix: '/comercial/relatorios',          module: 'RELATORIOS',              action: 'VIEW' },

  // Generic /comercial matches
  { prefix: '/comercial',                     module: 'VENDAS',                  action: 'VIEW' },
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
    // Não session → redirect to login
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
    const hasConfig = !!session.permissions['CONFIGURACOES:VIEW'];
    
    // As long as the user has some sort of configuration view, they can see the layout
    if (hasConfig) {
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
