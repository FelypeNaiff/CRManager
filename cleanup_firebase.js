const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function fixFile(relPath, replacements) {
  const p = path.join(srcDir, relPath);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    for (const [regex, replacement] of replacements) {
      content = content.replace(regex, replacement);
    }
    fs.writeFileSync(p, content, 'utf8');
    console.log(`Fixed ${relPath}`);
  }
}

fixFile('types/configuracoes.ts', [
  [/criado_em: z\.any\(\)\.optional\(\), \/\/ Aceita Timestamp do Supabase Firestore/g, 'criado_em: z.any().optional(),']
]);

fixFile('types/financeiro.ts', [
  [/createdAt: any; \/\/ Firestore Timestamp/g, 'createdAt: any;'],
  [/openedAt: any; \/\/ Firestore Timestamp/g, 'openedAt: any;']
]);

fixFile('app/error.tsx', [
  [/ \|\| error\.name === "FirestorePermissionError"/g, '']
]);

const filesToDelete = [
  'src/lib/legacy-stubs.ts',
  'src/lib/legacy-firestore-stubs.ts',
  'src/lib/legacy-auth-stubs.ts',
  'src/lib/crm-service.ts',
  'src/components/FirebaseErrorListener.tsx'
];

for (const file of filesToDelete) {
  const p = path.join(__dirname, file);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`Deleted ${file}`);
  }
}
