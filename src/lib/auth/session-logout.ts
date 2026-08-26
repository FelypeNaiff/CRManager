import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { PROFILE_SESSION_COOKIE } from './profile-selector';

interface LogoutDependencies {
  signOut(): Promise<void>;
  deleteSelector(): Promise<void>;
}

export async function executeLogout(dependencies: LogoutDependencies) {
  try {
    await dependencies.signOut();
  } catch {
    // Logout remains idempotent and local credentials are still cleared.
  }
  await dependencies.deleteSelector();
  return { success: true as const };
}

export async function performServerLogout() {
  return executeLogout({
    async signOut() {
      const supabase = await createClient();
      await supabase.auth.signOut();
    },
    async deleteSelector() {
      (await cookies()).delete(PROFILE_SESSION_COOKIE);
    },
  });
}
