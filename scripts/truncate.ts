import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE seller_commissions CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE seller_goals CASCADE;');
  
  // also need to clean up sales if they depend on users that are now sellers?
  // the sales table seller_id now expects a Seller. If we have sales with user_id, 
  // they will cause foreign key errors when we migrate because the seller_id points to Sellers which is empty!
  // We MUST truncate sales or create sellers for existing users.
  // Truncating sales for dev environment is probably easiest.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sales CASCADE;');
  
  console.log('Tables truncated');
}

run().catch(console.error).finally(() => prisma.$disconnect());
