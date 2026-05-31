import { runCrmEtl } from '../src/lib/crm/etl';

async function main() {
  console.log('Starting ETL runner script...');
  const companyId = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9';
  const report = await runCrmEtl(companyId);
  
  console.log('\n==================================================');
  console.log('ETL EXECUTION SUMMARY REPORT');
  console.log('==================================================');
  console.log(`Company ID: ${companyId}`);
  console.log('Customers:');
  console.log(`  Read:       ${report.totalCustomers.read}`);
  console.log(`  Migrated:   ${report.totalCustomers.migrated}`);
  console.log(`  Duplicated: ${report.totalCustomers.duplicated}`);
  console.log(`  Errors:     ${report.totalCustomers.errors}`);
  
  console.log('Children:');
  console.log(`  Read:       ${report.totalChildren.read}`);
  console.log(`  Migrated:   ${report.totalChildren.migrated}`);
  console.log(`  Errors:     ${report.totalChildren.errors}`);
  
  console.log('Tags:');
  console.log(`  Read:       ${report.totalTags.read}`);
  console.log(`  Migrated:   ${report.totalTags.migrated}`);
  console.log(`  Errors:     ${report.totalTags.errors}`);
  
  console.log('Wallets:');
  console.log(`  Read:       ${report.totalWallets.read}`);
  console.log(`  Migrated:   ${report.totalWallets.migrated}`);
  console.log(`  Errors:     ${report.totalWallets.errors}`);
  
  console.log('Wallet Movements:');
  console.log(`  Read:       ${report.totalMovements.read}`);
  console.log(`  Migrated:   ${report.totalMovements.migrated}`);
  console.log(`  Errors:     ${report.totalMovements.errors}`);
  
  console.log('History Records:');
  console.log(`  Read:       ${report.totalHistory.read}`);
  console.log(`  Migrated:   ${report.totalHistory.migrated}`);
  console.log(`  Errors:     ${report.totalHistory.errors}`);
  
  console.log('\nDetailed Logs:');
  report.logs.forEach(log => console.log(`  ${log}`));
  console.log('==================================================');
}

main()
  .catch(err => {
    console.error('ETL script failed:', err);
    process.exit(1);
  });
