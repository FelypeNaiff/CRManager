import { resolveServerAuthContext } from '@/lib/auth/server-auth-context';
import { createSessionHandler } from '@/lib/auth/api-handlers';

export const GET = createSessionHandler(resolveServerAuthContext);
