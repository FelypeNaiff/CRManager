import { NextResponse } from 'next/server';
import { ServerAuthError } from './server-auth-context';

export function authErrorStatus(error: unknown): 401 | 403 | 500 {
  if (!(error instanceof ServerAuthError)) return 500;
  return error.code === 'UNAUTHENTICATED' ? 401 : 403;
}

export function authErrorResponse(error: unknown) {
  const status = authErrorStatus(error);
  const message = status === 401
    ? 'Autenticação necessária.'
    : status === 403
      ? 'Acesso não permitido.'
      : 'Erro interno do servidor.';
  return NextResponse.json({ success: false, error: message }, { status });
}
