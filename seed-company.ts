import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9';
  
  await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId,
      cnpjCpf: '00000000000000',
      razaoSocial: 'NEEX / CRM Trupe - Production',
      nomeFantasia: 'CRM Trupe',
      tipoPessoa: 'PJ'
    }
  });
  
  console.log(`Company ${companyId} created or verified successfully.`);
  
  // Create a default user so the ETL/Tests have someone to attach logs to
  await prisma.user.upsert({
    where: { email: 'admin@neex.com' },
    update: {},
    create: {
      id: 'default-user-id-for-etl',
      companyId: companyId,
      name: 'Admin ETL',
      email: 'admin@neex.com',
      pinAccessHash: '1234',
      status: 'ACTIVE'
    }
  });
  
  console.log(`Default User created or verified successfully.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
