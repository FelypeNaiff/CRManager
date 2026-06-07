import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '../src');

const replacements = [
  { search: /Ã§/g, replace: 'ç' },
  { search: /Ã£/g, replace: 'ã' },
  { search: /Ã©/g, replace: 'é' },
  { search: /Ã¡/g, replace: 'á' },
  { search: /Ã³/g, replace: 'ó' },
  { search: /Ãº/g, replace: 'ú' },
  { search: /Ã\xad/g, replace: 'í' },
  { search: /Ãµ/g, replace: 'õ' },
  { search: /Ã¢/g, replace: 'â' },
  { search: /Ãª/g, replace: 'ê' },
  { search: /Ã‰/g, replace: 'É' },
  { search: /Ã“/g, replace: 'Ó' },
  { search: /Ãš/g, replace: 'Ú' },
  { search: /Ã‡/g, replace: 'Ç' },
  { search: /Ãƒ/g, replace: 'Ã' },
  { search: /Ã•/g, replace: 'Õ' },
  { search: /Â/g, replace: '' },
  { search: /\uFFFD/g, replace: '' }
];

function processDirectory(directory: string) {
  let count = 0;
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      count += processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let originalContent = content;

      for (const { search, replace } of replacements) {
        content = content.replace(search, replace);
      }
      
      // Also fix explicit words just in case regex missed something due to weird invisible chars
      content = content.replace(/segmentaÃ§Ã£o/g, 'segmentação');
      content = content.replace(/SecundÃ¡rio/g, 'Secundário');
      content = content.replace(/ObservaÃ§Ãµes/g, 'Observações');
      content = content.replace(/HistÃ³rico/g, 'Histórico');
      content = content.replace(/AlteraÃ§Ãµes/g, 'Alterações');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`Corrigido: ${fullPath}`);
        count++;
      }
    }
  }

  return count;
}

console.log('Iniciando correção no frontend...');
const totalFixed = processDirectory(SRC_DIR);
console.log(`\nFinalizado! Total de arquivos corrigidos: ${totalFixed}`);
