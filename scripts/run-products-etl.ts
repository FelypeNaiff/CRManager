import { runProductsEtl } from '../src/lib/crm/products-etl';

async function main() {
  console.log('Starting Products & Inventory ETL runner script...');
  const companyId = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9';
  const report = await runProductsEtl(companyId);
  
  console.log('\n==================================================');
  console.log('PRODUCTS & INVENTORY ETL SUMMARY REPORT');
  console.log('==================================================');
  console.log(`Company ID: ${companyId}`);
  console.log('Product Categories:');
  console.log(`  Read:       ${report.categories.read}`);
  console.log(`  Migrated:   ${report.categories.migrated}`);
  console.log(`  Errors:     ${report.categories.errors}`);
  
  console.log('Suppliers:');
  console.log(`  Read:       ${report.suppliers.read}`);
  console.log(`  Migrated:   ${report.suppliers.migrated}`);
  console.log(`  Errors:     ${report.suppliers.errors}`);
  
  console.log('Products:');
  console.log(`  Read:       ${report.products.read}`);
  console.log(`  Migrated:   ${report.products.migrated}`);
  console.log(`  Errors:     ${report.products.errors}`);
  
  console.log('Inventory Movements Created:');
  console.log(`  Created:    ${report.movements.created}`);
  console.log(`  Errors:     ${report.movements.errors}`);
  
  console.log('\nDetailed Logs:');
  report.logs.forEach(log => console.log(`  ${log}`));
  console.log('==================================================');
}

main()
  .catch(err => {
    console.error('Products ETL script failed:', err);
    process.exit(1);
  });
