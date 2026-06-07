import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '../src');

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const targetExtensions = ['.tsx', '.ts', '.jsx', '.js'];

walkDir(SRC_DIR, (filePath) => {
  if (!targetExtensions.includes(path.extname(filePath))) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  const fixes = [
    { search: /Alteraâ”œºâ”œÃ\x81es/g, replace: 'Alterações' },
    { search: /â”¬Ã€/g, replace: 'à' },
    { search: /BÃ´nus/g, replace: 'Bônus' },
    { search: /Aâ”œºâ”œúo/g, replace: 'Ação' },
    { search: /Saâ”œ¡da/g, replace: 'Saída' },
    { search: /Responsâ”œível/g, replace: 'Responsável' },
    { search: /Responsâ”œÃ\xadvel/g, replace: 'Responsável' },
    { search: /Balcâ”œúo/g, replace: 'Balcão' },
    { search: /Balcâ”œÃºo/g, replace: 'Balcão' },
    { search: /histâ”œâ”‚rico/g, replace: 'histórico' },
    { search: /Opâ”œºâ”œÃ\x81es/g, replace: 'Opções' },
    { search: /Condiâ”œºâ”œÃ\x81o/g, replace: 'Condição' },
    { search: /Aâ”œºâ”œÃ\x83o/g, replace: 'Ação' },
    { search: /Inâ”œ\xadcio/g, replace: 'Início' },
    { search: /Grâ”œÃ\x81fico/g, replace: 'Gráfico' },
    { search: /Histâ”œÃ\x83rico/g, replace: 'Histórico' },
    { search: /Usuâ”œÃ\x81rio/g, replace: 'Usuário' },
    { search: /Concluâ”œ\xaddo/g, replace: 'Concluído' },
    { search: /Atraâ”œ\xaddo/g, replace: 'Atraído' },
    { search: /Devoluâ”œºâ”œÃ\x81es/g, replace: 'Devoluções' },
    { search: /Visualizaâ”œºâ”œÃ\x81o/g, replace: 'Visualização' },
    { search: /Excluâ”œ\xaddo/g, replace: 'Excluído' },
    { search: /M\uFFFDdulo/g, replace: 'Módulo' },
    { search: /sincroniza\uFFFD\uFFFDo/g, replace: 'sincronização' },
    { search: /estar\uFFFD/g, replace: 'estará' },
    { search: /dispon\uFFFDvel/g, replace: 'disponível' },
    { search: /anivers\uFFFDrios/g, replace: 'aniversários' },
    { search: /No/g, replace: 'Não' },
    { search: /\uFFFD/g, replace: '' },
    { search: /Ã£/g, replace: 'ã' },
    { search: /Ã§/g, replace: 'ç' },
    { search: /Ã©/g, replace: 'é' },
    { search: /Ã¡/g, replace: 'á' },
    { search: /Ã³/g, replace: 'ó' },
    { search: /Ãº/g, replace: 'ú' },
    { search: /Ã\xad/g, replace: 'í' },
    { search: /Ãµ/g, replace: 'õ' },
    { search: /Ã¢/g, replace: 'â' },
    { search: /Ãª/g, replace: 'ê' }
  ];

  for (const fix of fixes) {
    content = content.replace(fix.search, fix.replace);
  }

  // Remove any standalone Ã or Â or replacement characters only if they are clearly garbled
  content = content.replace(/Ã[^A-Za-z0-9]/g, ' ');
  content = content.replace(/Â/g, '');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed remaining encoding in: ${filePath}`);
  }
});

// Fix Prisma Schema
let prismaContent = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf-8');
let newPrismaContent = prismaContent.replace(/Ã|Â||\uFFFD/g, '');
if(newPrismaContent !== prismaContent) {
  fs.writeFileSync(path.join(__dirname, '../prisma/schema.prisma'), newPrismaContent, 'utf-8');
  console.log('Fixed Prisma schema');
}
