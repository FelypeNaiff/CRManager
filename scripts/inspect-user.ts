import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function run() {
  const user = await p.user.findFirst({
    where: {
      OR: [{ username: 'felypenaiff' }, { email: 'felypenaiff01@gmail.com' }]
    },
    include: {
      role: { include: { permissions: true } }
    }
  })
  console.log('\n=== USER FOUND ===')
  console.log('ID:', user?.id)
  console.log('nome:', user?.nome)
  console.log('name:', (user as any)?.name)
  console.log('email:', user?.email)
  console.log('username:', user?.username)
  console.log('status:', user?.status)
  console.log('permitirAcesso:', user?.permitirAcesso)
  console.log('companyId:', user?.companyId)
  console.log('roleId:', user?.roleId)
  console.log('role.name:', user?.role?.name)
  console.log('permissions count:', user?.role?.permissions?.length ?? 0)
  await p.$disconnect()
}

run().catch(console.error)
