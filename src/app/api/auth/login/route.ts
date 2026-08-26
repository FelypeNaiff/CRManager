import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

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

    // Supabase establishes identity. A separate PIN step selects an eligible
    // operational profile and emits the signed selector cookie.
    return NextResponse.json({ success: true, redirectTo: '/selecionar-perfil' })

  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
