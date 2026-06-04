import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.create({
    data: {
      name: 'Test Company',
      document: '11122233344455',
      cnpjCpf: '11122233344455',
      domain: 'test.neex.com'
    }
  });

  const role = await prisma.role.create({
    data: {
      companyId: company.id,
      name: 'Admin Role Test',
      isAdmin: true,
      status: 'ACTIVE'
    }
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      roleId: role.id,
      name: 'Admin Test',
      email: 'admin@test.neex.com',
      pinAccessHash: '1234',
      status: 'ACTIVE',
      permitirAcesso: true
    }
  });

  console.log(`Created admin user ID: ${user.id}`);
  console.log(`Created company ID: ${company.id}`);
}

main().finally(() => prisma.$disconnect());
