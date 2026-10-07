const fs = require('fs');
const path = require('path');

const files = [
  'src/app/(dashboard)/crm/clientes/page.tsx',
  'src/app/(dashboard)/crm/clientes/_components/details/tabs/customer-children-tab.tsx',
  'src/app/(dashboard)/crm/clientes/_components/details/tabs/customer-wallet-tab.tsx',
  'src/app/(dashboard)/crm/clientes/_components/details/customer-details-sheet.tsx'
];

files.forEach(f => {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/\\`/g, '`');
    content = content.replace(/\\\$/g, '$');
    fs.writeFileSync(p, content, 'utf8');
  }
});
