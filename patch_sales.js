const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'sales', 'sales-service.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /\/\/ Estornar Contas a Receber e Saldo de Carteira \/ Dinheiro\s*await this\.dependencies\.receivables\.cancelReceivablesFromSale\(\s*sale\.id,\s*data\.cancelledByUserId,\s*companyId,\s*tx,?\s*\);/,
  `// Estornar Contas a Receber e Saldo de Carteira / Dinheiro
      await this.dependencies.receivables.cancelReceivablesFromSale(
        sale.id,
        data.cancelledByUserId,
        companyId,
        tx,
        { refundMethod: (data as any).refundMethod }
      );`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched sales successfully");
