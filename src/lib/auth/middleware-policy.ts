export const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/brasilapi/cep/',
  '/api/brasilapi/cnpj/',
] as const;

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix
  );
}

export type MiddlewareDecision = 'allow' | 'login' | 'select-profile' | 'dashboard' | 'api-401' | 'api-403';

export function decideRequest(input: {
  pathname: string;
  hasSupabaseIdentity: boolean;
  hasValidSelector: boolean;
}): MiddlewareDecision {
  const { pathname, hasSupabaseIdentity, hasValidSelector } = input;
  if (isPublicApi(pathname) || pathname.startsWith('/_next') || pathname === '/favicon.ico') return 'allow';
  if (pathname === '/login') return hasSupabaseIdentity && hasValidSelector ? 'dashboard' : 'allow';
  if (pathname === '/setup') return 'allow';
  if (pathname.startsWith('/api/')) {
    if (!hasSupabaseIdentity) return 'api-401';
    if (!hasValidSelector) return 'api-403';
    return 'allow';
  }
  if (pathname === '/selecionar-perfil') {
    if (!hasSupabaseIdentity) return 'login';
    return hasValidSelector ? 'dashboard' : 'allow';
  }
  if (!hasSupabaseIdentity) return 'login';
  if (!hasValidSelector) return 'select-profile';
  return 'allow';
}
