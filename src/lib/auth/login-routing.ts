import type { ServerAuthContext } from './server-auth-context';
import { createProfileSession } from './profile-session';

type TrustedLoginContext = Pick<ServerAuthContext, 'authUserId' | 'userId' | 'isAdmin'>;

export interface AuthenticatedLoginOutcome {
  redirectTo: '/dashboard' | '/selecionar-perfil';
  profileSession: string | null;
}

export function routeAuthenticatedLogin(
  context: TrustedLoginContext,
  issueProfileSession: (profileId: string, authUserId: string) => string = createProfileSession
): AuthenticatedLoginOutcome {
  if (!context.isAdmin) {
    return { redirectTo: '/selecionar-perfil', profileSession: null };
  }

  return {
    redirectTo: '/dashboard',
    profileSession: issueProfileSession(context.userId, context.authUserId),
  };
}
