import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const companies = await p.company.findMany();
  console.log(JSON.stringify(companies, null, 2));
}
main().finally(() => p.$disconnect());
