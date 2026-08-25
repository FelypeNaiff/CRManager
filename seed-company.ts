import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.ENVIRONMENT === 'production') {
    throw new Error('Este bootstrap de desenvolvimento/ETL não pode ser executado em produção.');
  }

  const companyId = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9';
  const inaccessiblePinHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  
  await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId,
      cnpjCpf: '00000000000000',
      razaoSocial: 'NEEX - Sistema de Gestão de Vendas',
      nomeFantasia: 'NEEX',
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
      pinAccessHash: inaccessiblePinHash,
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
