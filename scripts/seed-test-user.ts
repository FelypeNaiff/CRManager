import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import {
  sanitizeAdminDatabaseError,
  withDestructiveAdminDatabase,
} from '../src/lib/database/admin-script-access';

export async function main(prisma: PrismaClient, production: boolean) {
  if (production) {
    throw new Error('Este seed de teste não pode ser executado em produção.');
  }

  const inaccessiblePinHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

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
      pinAccessHash: inaccessiblePinHash,
      status: 'ACTIVE',
      permitirAcesso: true
    }
  });

  console.log('Test company, role and user created successfully.');
}

if (require.main === module) {
  withDestructiveAdminDatabase(
    (prisma, access) => main(prisma, access.production),
    { allowProductionDestructive: false },
  ).catch(error => {
    console.error('Test seed failed:', sanitizeAdminDatabaseError(error));
    process.exitCode = 1;
  });
}
