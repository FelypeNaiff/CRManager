const fs = require('fs');

let p2 = 'src/components/layout/app-sidebar.tsx';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(/const db = useFirestore\(\)/g, '');
c2 = c2.replace(/const configRef = useMemoFirebase[\s\S]*?\}, \[db, activeProfile\?\.empresaId\]\)/g, '');
c2 = c2.replace(/const \{ data: empresaConfig \} = useDoc\(configRef\)/g, '');
c2 = c2.replace(/const logoUrl = empresaConfig\?\.logo_url \|\| empresaConfig\?\.logo_reduzida/g, 'const logoUrl = null');
c2 = c2.replace(/const smallLogoUrl = empresaConfig\?\.logo_reduzida \|\| empresaConfig\?\.logo_url/g, 'const smallLogoUrl = null');
c2 = c2.replace(/const companyName = empresaConfig\?\.nome_fantasia \|\| \"NEEX\"/g, 'const companyName = "NEEX"');
fs.writeFileSync(p2, c2, 'utf8');

let p3 = 'PROJECT_STATUS.md';
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace(/- \[ \] \*\*P2:\*\* Remover ou concluir de vez a utilização de stubs/g, '- [x] **P2:** Remover ou concluir de vez a utilização de stubs');
fs.writeFileSync(p3, c3, 'utf8');

console.log('Fixed app-sidebar and project status');
