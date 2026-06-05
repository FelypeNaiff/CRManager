import { NextResponse } from 'next/server';
import { getActiveProfileSession } from '@/lib/auth/actions';

/**
 * GET /api/auth/session
 * Returns the active profile session (without exposing the full permissions map).
 * Used by client components that need to read session data.
 */
export async function GET() {
  try {
    const session = await getActiveProfileSession();

    if (!session) {
      const response = NextResponse.json({ authenticated: false, session: null }, { status: 401 });
      response.cookies.delete('@crmanager:activeProfileSession');
      return response;
    }

    // Return safe subset — never expose the full permissions object to the client
    return NextResponse.json({
      authenticated: true,
      session: {
        userId: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        isAdmin: session.isAdmin,
        companyId: session.companyId,
        permissions: session.permissions,
      },
    });
  } catch (error) {
    console.error('[API /auth/session] Error:', error);
    return NextResponse.json({ authenticated: false, session: null }, { status: 500 });
  }
}
