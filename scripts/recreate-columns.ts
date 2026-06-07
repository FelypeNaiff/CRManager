import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS commission_rate CASCADE;');
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS is_seller CASCADE;');
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS seller_code CASCADE;');
  
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00;');
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN is_seller BOOLEAN NOT NULL DEFAULT false;');
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN seller_code TEXT;');
  console.log('Recreated columns perfectly');
}

run().catch(console.error).finally(() => prisma.$disconnect());
