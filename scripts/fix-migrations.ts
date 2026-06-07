import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const migrationFile = path.join(
    __dirname,
    "../prisma/migrations/20260605153000_separate_sellers/migration.sql"
  );
  
  const content = fs.readFileSync(migrationFile, "utf8");
  
  // Calculate SHA256 checksum of the migration content
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  console.log("Local migration file checksum (hex):", hash);

  // 1. Delete failed (unfinished) migration records
  const deletedCount = await prisma.$executeRaw`
    DELETE FROM _prisma_migrations 
    WHERE migration_name = '20260605153000_separate_sellers' 
      AND finished_at IS NULL
  `;
  console.log(`Deleted ${deletedCount} unfinished migration records.`);

  // 2. Fetch the completed migration record
  const completed = await prisma.$queryRaw<any[]>`
    SELECT id, migration_name, checksum 
    FROM _prisma_migrations 
    WHERE migration_name = '20260605153000_separate_sellers' 
      AND finished_at IS NOT NULL
  `;
  
  if (completed.length > 0) {
    const dbChecksum = completed[0].checksum;
    console.log("Database migration checksum:", dbChecksum);
    
    if (dbChecksum !== hash) {
      console.log("Checksum mismatch! Updating database with local checksum...");
      await prisma.$executeRaw`
        UPDATE _prisma_migrations 
        SET checksum = ${hash} 
        WHERE id = ${completed[0].id}
      `;
      console.log("Updated checksum successfully.");
    } else {
      console.log("Checksums match perfectly!");
    }
  } else {
    console.log("No completed migration record found in database for 20260605153000_separate_sellers.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
