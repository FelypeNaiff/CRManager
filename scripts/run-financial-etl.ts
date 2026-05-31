import { runFinancialEtl } from '../src/lib/financial/financial-etl';

async function main() {
  console.log('Starting Financial ETL runner script...');
  const companyId = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9';
  const report = await runFinancialEtl(companyId);
  
  console.log('\n==================================================');
  console.log('FINANCIAL ETL SUMMARY REPORT');
  console.log('==================================================');
  console.log(`Company ID: ${companyId}`);
  
  console.log('Bank Accounts:');
  console.log(`  Read:       ${report.bankAccounts.read}`);
  console.log(`  Migrated:   ${report.bankAccounts.migrated}`);
  console.log(`  Errors:     ${report.bankAccounts.errors}`);
  
  console.log('Payment Methods:');
  console.log(`  Read:       ${report.paymentMethods.read}`);
  console.log(`  Migrated:   ${report.paymentMethods.migrated}`);
  console.log(`  Errors:     ${report.paymentMethods.errors}`);
  
  console.log('Financial Accounts (Plano de Contas):');
  console.log(`  Read:       ${report.financialAccounts.read}`);
  console.log(`  Migrated:   ${report.financialAccounts.migrated}`);
  console.log(`  Errors:     ${report.financialAccounts.errors}`);
  
  console.log('Receivables:');
  console.log(`  Read:       ${report.receivables.read}`);
  console.log(`  Migrated:   ${report.receivables.migrated}`);
  console.log(`  Errors:     ${report.receivables.errors}`);
  
  console.log('Cash Registers (Caixas):');
  console.log(`  Read:       ${report.cashRegisters.read}`);
  console.log(`  Migrated:   ${report.cashRegisters.migrated}`);
  console.log(`  Errors:     ${report.cashRegisters.errors}`);

  console.log('\nDetailed Logs:');
  report.logs.forEach(log => console.log(`  ${log}`));
  console.log('==================================================');
}

main()
  .catch(err => {
    console.error('ETL script failed:', err);
    process.exit(1);
  });
