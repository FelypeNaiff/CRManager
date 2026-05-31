import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

// Using service role key for administrative tasks (like creating users bypassing email confirmation)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)
const prisma = new PrismaClient()

async function createMasterUser() {
  const masterData = {
    username: 'felypenaiff',
    email: 'felypenaiff01@gmail.com',
    password: 'Mateus0102#',
    role: 'ADMIN',
    name: 'Felipe Naiff',
  }

  try {
    console.log('[Script] Iniciando criação/atualização do usuário Master...')

    // 1. Create or Update user in Supabase Auth
    let authUserId: string
    const { data: { users }, error: fetchError } = await supabase.auth.admin.listUsers()
    
    if (fetchError) throw new Error(`Erro ao buscar usuários no Supabase: ${fetchError.message}`)

    const existingAuthUser = users.find(u => u.email === masterData.email)

    if (!existingAuthUser) {
      console.log('[Script] Usuário não encontrado no Supabase. Criando...')
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: masterData.email,
        password: masterData.password,
        email_confirm: true,
      })
      if (createError || !newUser.user) throw new Error(`Erro ao criar no Supabase: ${createError?.message}`)
      authUserId = newUser.user.id
      console.log(`[Script] Usuário criado no Supabase com ID: ${authUserId}`)
    } else {
      console.log(`[Script] Usuário já existe no Supabase. ID: ${existingAuthUser.id}`)
      authUserId = existingAuthUser.id
      // Update password just to be sure
      await supabase.auth.admin.updateUserById(authUserId, { password: masterData.password })
    }

    // 2. Ensure Company exists (since User requires companyId in Prisma)
    let company = await prisma.company.findFirst()
    if (!company) {
      company = await prisma.company.create({
        data: {
          cnpjCpf: '00000000000',
          razaoSocial: 'NEEX Master Company',
          nomeFantasia: 'NEEX',
        }
      })
    }

    // 3. Ensure ADMIN Role exists
    let adminRole = await prisma.role.findFirst({
      where: { name: masterData.role, companyId: company.id }
    })
    
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          companyId: company.id,
          name: masterData.role,
          description: 'Acesso total ao sistema',
          isAdmin: true,
        }
      })
      console.log('[Script] Role ADMIN criada.')
    }

    // 4. Upsert User in Prisma
    const prismaUser = await prisma.user.upsert({
      where: { email: masterData.email },
      update: {
        username: masterData.username,
        roleId: adminRole.id,
        status: 'ACTIVE',
        permitirAcesso: true,
      },
      create: {
        id: authUserId, // optionally sync IDs
        companyId: company.id,
        username: masterData.username,
        email: masterData.email,
        name: masterData.name,
        roleId: adminRole.id,
        pinAccessHash: 'master', // mock pin
        status: 'ACTIVE',
        permitirAcesso: true,
      }
    })

    console.log('[Script] Usuário Master configurado com sucesso no Prisma!')
    console.log(`- Username: ${prismaUser.username}`)
    console.log(`- Role: ${masterData.role}`)

  } catch (error) {
    console.error('[Script] Falha ao configurar usuário master:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createMasterUser()
