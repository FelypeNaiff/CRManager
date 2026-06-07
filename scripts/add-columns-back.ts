import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2);');
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN;');
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_code TEXT;');
  
  await prisma.$executeRawUnsafe('UPDATE users SET commission_rate = NULL, is_seller = NULL, seller_code = NULL;');
  
  console.log('Added columns back and set to NULL');
}

run().catch(console.error).finally(() => prisma.$disconnect());
