import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { decideRequest } from '@/lib/auth/middleware-policy';
import { verifyProfileSelectorAtEdge } from '@/lib/auth/profile-selector-edge';

export const SESSION_COOKIE = '@crmanager:activeProfileSession';

function preserveSupabaseCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authUserId: string | null = null;

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) authUserId = data.user.id;
  }

  const selector = request.cookies.get(SESSION_COOKIE)?.value;
  const selectorSecret = process.env.NEEX_PROFILE_SESSION_SECRET;
  const hasValidSelector = !!(
    authUserId && selector && selectorSecret
    && await verifyProfileSelectorAtEdge(selector, selectorSecret, authUserId)
  );
  const decision = decideRequest({
    pathname: request.nextUrl.pathname,
    hasSupabaseIdentity: !!authUserId,
    hasValidSelector,
  });

  if (decision === 'allow') return response;
  if (decision === 'api-401' || decision === 'api-403') {
    return preserveSupabaseCookies(response, NextResponse.json(
      { success: false, error: decision === 'api-401' ? 'Autenticação necessária.' : 'Acesso não permitido.' },
      { status: decision === 'api-401' ? 401 : 403 }
    ));
  }

  const destination = decision === 'login'
    ? '/login'
    : decision === 'dashboard'
      ? '/dashboard'
      : '/selecionar-perfil';
  const redirect = NextResponse.redirect(new URL(destination, request.url));
  preserveSupabaseCookies(response, redirect);
  if (selector && !hasValidSelector) redirect.cookies.delete(SESSION_COOKIE);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
