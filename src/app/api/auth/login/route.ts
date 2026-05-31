import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Usuário e senha são obrigatórios.' }, { status: 400 })
    }

    console.log(`[LOGIN] Tentativa para: ${username}`)

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
      console.log(`[LOGIN] Usuário não encontrado: ${username}`)
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 401 })
    }

    if (user.status !== 'ACTIVE' || user.permitirAcesso === false) {
      console.log(`[LOGIN] Usuário inativo: ${user.email}`)
      return NextResponse.json({ success: false, error: 'Usuário inativo' }, { status: 403 })
    }

    console.log(`[LOGIN] Usuário encontrado. Autenticando com email: ${user.email}`)

    // Auth with Supabase using email
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password
    })

    if (authError || !authData.session) {
      console.error(`[LOGIN] Falha no Supabase Auth:`, authError?.message)
      return NextResponse.json({ success: false, error: `Falha Supabase Auth: ${authError?.message || 'Sessão nula'}` }, { status: 401 })
    }

    console.log(`[LOGIN] Sucesso no Supabase Auth. Criando cookie de sessão.`)

    // Populating SESSION_COOKIE for RBAC compat
    const permissionsMap: Record<string, boolean> = {}
    if (user.role?.permissions) {
      user.role.permissions.forEach((p: any) => {
        if (p.allowed) {
          permissionsMap[`${p.module}:${p.action}`] = true
        }
      })
    }

    const sessionData = {
      userId: user.id,
      companyId: user.companyId ?? '',
      name: user.name,              // Prisma field is 'name', not 'nome'
      email: user.email,
      role: user.role?.name || 'USER',
      isAdmin: user.role?.isAdmin === true || user.role?.name === 'ADMIN',
      permissions: permissionsMap,
    }

    const cookieStore = await cookies()
    cookieStore.set('@crmanager:activeProfileSession', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })

    return NextResponse.json({ success: true, redirectTo: '/dashboard' })

  } catch (error: any) {
    console.error('[LOGIN] Erro interno capturado com stack:', error.stack || error)
    return NextResponse.json({ success: false, error: `Erro interno: ${error.message || String(error)}` }, { status: 500 })
  }
}
