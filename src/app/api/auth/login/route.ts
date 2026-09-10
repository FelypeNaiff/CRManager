import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { resolveBaseServerAuthContext } from '@/lib/auth/server-auth-context'
import { routeAuthenticatedLogin } from '@/lib/auth/login-routing'
import { getProfileSessionCookieOptions } from '@/lib/auth/profile-session'
import { PROFILE_SESSION_COOKIE } from '@/lib/auth/profile-selector'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Usuário e senha são obrigatórios.' }, { status: 400 })
    }

    // Find user by username OR email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 401 })
    }

    if (user.status !== 'ACTIVE' || user.permitirAcesso === false) {
      return NextResponse.json({ success: false, error: 'Usuário inativo' }, { status: 403 })
    }

    // Auth with Supabase using email
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password
    })

    if (authError || !authData.session) {
      return NextResponse.json({ success: false, error: 'Credenciais inválidas.' }, { status: 401 })
    }

    // Authorization is resolved again from the authenticated Supabase identity
    // and fresh Prisma data. Client-supplied role or tenant data is never used.
    const context = await resolveBaseServerAuthContext()
    const outcome = routeAuthenticatedLogin(context)

    if (outcome.profileSession) {
      const cookieStore = await cookies()
      cookieStore.set(
        PROFILE_SESSION_COOKIE,
        outcome.profileSession,
        getProfileSessionCookieOptions()
      )
    }

    return NextResponse.json({ success: true, redirectTo: outcome.redirectTo })

  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
