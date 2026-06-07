import { prisma } from "../src/lib/prisma";

async function main() {
  const migrations = await prisma.$queryRaw<any[]>`
    SELECT id, migration_name, checksum, finished_at 
    FROM _prisma_migrations 
    ORDER BY finished_at DESC 
    LIMIT 5
  `;
  console.log("Last 5 migrations in DB:", JSON.stringify(migrations, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
