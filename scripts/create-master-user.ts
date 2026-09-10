/**
 * TEMPORARY DEVELOPMENT/BOOTSTRAP UTILITY.
 *
 * This script exists only while NEEX still uses the temporary password login
 * during development. The definitive authentication architecture is Google
 * Login through Supabase Auth. Do not use this utility in production.
 *
 * No credential has a default or fallback. Required values must be supplied
 * explicitly through the local environment and are never written to logs.
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import {
  sanitizeAdminDatabaseError,
  withDestructiveAdminDatabase,
} from '../src/lib/database/admin-script-access'

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }
  return value
}

export async function createDevelopmentAdminUser(prisma: PrismaClient, production: boolean) {
  if (production) {
    throw new Error('Este utilitário temporário não pode ser executado em produção.')
  }

  const supabaseUrl = requireEnvironmentVariable('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseSecretKey = requireEnvironmentVariable('SUPABASE_SECRET_KEY')
  const bootstrapEmail = requireEnvironmentVariable('NEEX_BOOTSTRAP_EMAIL')
  const bootstrapPassword = requireEnvironmentVariable('NEEX_BOOTSTRAP_PASSWORD')
  const bootstrapPin = requireEnvironmentVariable('NEEX_BOOTSTRAP_PIN')
  const bootstrapName = process.env.NEEX_BOOTSTRAP_NAME?.trim() || 'Administrador de Desenvolvimento'
  const bootstrapUsername = process.env.NEEX_BOOTSTRAP_USERNAME?.trim() || bootstrapEmail.split('@')[0]

  // Validate the administrative PostgreSQL target before the first external Auth write.
  // Supabase Auth and PostgreSQL are still separate systems: this reduces partial
  // failure risk but cannot provide atomic rollback across both services.
  await prisma.$connect()
  const supabase = createClient(supabaseUrl, supabaseSecretKey)
  const pinAccessHash = await bcrypt.hash(bootstrapPin, 12)

  console.log('[Bootstrap] Iniciando configuração temporária do administrador de desenvolvimento...')

    let authUserId: string
    const { data: { users }, error: fetchError } = await supabase.auth.admin.listUsers()

    if (fetchError) throw new Error(`Erro ao buscar usuários no Supabase: ${fetchError.message}`)

    const existingAuthUser = users.find((user) => user.email === bootstrapEmail)

    if (!existingAuthUser) {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: bootstrapEmail,
        password: bootstrapPassword,
        email_confirm: true,
      })
      if (createError || !newUser.user) {
        throw new Error(`Erro ao criar usuário no Supabase: ${createError?.message}`)
      }
      authUserId = newUser.user.id
      console.log('[Bootstrap] Usuário temporário criado no Supabase Auth.')
    } else {
      authUserId = existingAuthUser.id
      const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
        password: bootstrapPassword,
      })
      if (updateError) {
        throw new Error(`Erro ao atualizar usuário no Supabase: ${updateError.message}`)
      }
      console.log('[Bootstrap] Usuário temporário já existente no Supabase Auth.')
    }

    let company = await prisma.company.findFirst()
    if (!company) {
      company = await prisma.company.create({
        data: {
          cnpjCpf: '00000000000',
          razaoSocial: 'NEEX Development Company',
          nomeFantasia: 'NEEX',
        },
      })
    }

    let adminRole = await prisma.role.findFirst({
      where: { name: 'ADMIN', companyId: company.id },
    })

    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          companyId: company.id,
          name: 'ADMIN',
          description: 'Acesso total ao sistema',
          isAdmin: true,
        },
      })
    }

    await prisma.user.upsert({
      where: { email: bootstrapEmail },
      update: {
        username: bootstrapUsername,
        name: bootstrapName,
        roleId: adminRole.id,
        pinAccessHash,
        status: 'ACTIVE',
        permitirAcesso: true,
      },
      create: {
        id: authUserId,
        companyId: company.id,
        username: bootstrapUsername,
        email: bootstrapEmail,
        name: bootstrapName,
        roleId: adminRole.id,
        pinAccessHash,
        status: 'ACTIVE',
        permitirAcesso: true,
      },
    })

  console.log('[Bootstrap] Administrador temporário configurado com sucesso.')
}

if (require.main === module) {
  withDestructiveAdminDatabase(
    (prisma, access) => createDevelopmentAdminUser(prisma, access.production),
    { allowProductionDestructive: false },
  ).catch((error) => {
    console.error(
      '[Bootstrap] Falha ao configurar o administrador temporário:',
      sanitizeAdminDatabaseError(error),
    )
    process.exitCode = 1
  })
}
