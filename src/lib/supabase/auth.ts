import { createClient } from './server';

/**
 * Gets the current Supabase Auth user session from the server-side.
 */
export async function getSessionUser() {
  const supabase = await createClient();
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error getting session user:', error);
    return null;
  }
}

/**
 * Checks if there is an active Supabase session.
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getSessionUser();
  return !!user;
}

/**
 * Sign out of the Supabase Auth session on the server.
 */
export async function serverSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
