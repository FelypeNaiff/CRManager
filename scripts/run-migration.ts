import { MigrationService } from "../src/lib/wallet/migration-service";

async function run() {
  try {
    const result = await MigrationService.migrateHistoricalData();
    console.log("Migration finished successfully:", result);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  }
}

run();
