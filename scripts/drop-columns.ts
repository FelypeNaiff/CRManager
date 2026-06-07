import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS commission_rate CASCADE;');
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS is_seller CASCADE;');
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS seller_code CASCADE;');
  console.log('Dropped columns');
}

run().catch(console.error).finally(() => prisma.$disconnect());
