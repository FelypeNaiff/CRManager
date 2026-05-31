import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function run() {
  console.log('\n=== DASHBOARD LOAD FLOW TEST ===\n')

  // Test 1: master user exists
  const user = await p.user.findFirst({
    where: { OR: [{ username: 'felypenaiff' }, { email: 'felypenaiff01@gmail.com' }] },
    include: { role: { include: { permissions: true } } }
  })

  const pass = (label: string, cond: boolean) =>
    console.log(`  [${cond ? '✅ PASS' : '❌ FAIL'}] ${label}`)

  pass('Master user exists in Prisma', !!user)
  pass('user.name is set', !!user?.name)
  pass('user.email is set', !!user?.email)
  pass('user.username is set', !!user?.username)
  pass('user.status is ACTIVE', user?.status === 'ACTIVE')
  pass('user.permitirAcesso is true', user?.permitirAcesso === true)
  pass('user.companyId is set', !!user?.companyId)
  pass('user has a role', !!user?.role)
  pass('role.name is ADMIN', user?.role?.name === 'ADMIN')
  pass('role.isAdmin is true', user?.role?.isAdmin === true)

  console.log('\n=== COOKIE SIMULATION ===\n')
  if (user) {
    const permissionsMap: Record<string, boolean> = {}
    user.role?.permissions?.forEach((p: any) => {
      if (p.allowed) permissionsMap[`${p.module}:${p.action}`] = true
    })

    const sessionData = {
      userId: user.id,
      companyId: user.companyId ?? '',
      name: user.name,
      email: user.email,
      role: user.role?.name || 'USER',
      isAdmin: user.role?.isAdmin === true || user.role?.name === 'ADMIN',
      permissions: permissionsMap,
    }
    console.log('  Session cookie contents:')
    console.log(JSON.stringify(sessionData, null, 4))
    pass('isAdmin flag is true in session', sessionData.isAdmin)
    pass('name is defined in session', !!sessionData.name)
  }

  await p.$disconnect()
  console.log('\n=== TEST COMPLETE ===\n')
}

run().catch(console.error)
