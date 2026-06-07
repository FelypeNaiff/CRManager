import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '../src');

// Function to walk the directory
function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const targetExtensions = ['.tsx', '.ts', '.jsx', '.js'];

walkDir(SRC_DIR, (filePath) => {
  if (!targetExtensions.includes(path.extname(filePath))) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Dicionário de Traduções (só textos visíveis - usar bordas de palavras, ou match em JSX Text)
  // Como é difícil parsear JSX sem AST, faremos replaces conservadores de strings comuns no projeto
  // Note: a word boundary \b helps avoid replacing internal code, but we must be careful with imports.
  // For safety, we can do some explicit string replacements instead of global word replacement.
  
  // Substituições seguras de UI (evitando camelCase ou imports comuns)
  const uiTranslations = [
    { s: />Customer</g, r: '>Cliente<' },
    { s: />Customers</g, r: '>Clientes<' },
    { s: />Child</g, r: '>Filho<' },
    { s: />Children</g, r: '>Filhos<' },
    { s: />Wallet</g, r: '>Carteira<' },
    // "Dashboard" and "Settings" are requested
    { s: />Settings</g, r: '>Configurações<' },
    { s: />Products</g, r: '>Produtos<' },
    { s: />Sales</g, r: '>Vendas<' },
    { s: />Reports</g, r: '>Relatórios<' },
    { s: />Users</g, r: '>Usuários<' },
    { s: />Permissions</g, r: '>Permissões<' },
    { s: /"Customer"/g, r: '"Cliente"' },
    { s: /"Customers"/g, r: '"Clientes"' },
    { s: /'Customer'/g, r: "'Cliente'" },
    { s: /'Customers'/g, r: "'Clientes'" },
    { s: /"Wallet"/g, r: '"Carteira"' },
    { s: /"Settings"/g, r: '"Configurações"' },
    { s: /"Products"/g, r: '"Produtos"' },
    { s: /"Sales"/g, r: '"Vendas"' },
    { s: /"Reports"/g, r: '"Relatórios"' },
    { s: /"Users"/g, r: '"Usuários"' },
    { s: /"Permissions"/g, r: '"Permissões"' },
  ];

  for (const { s, r } of uiTranslations) {
    content = content.replace(s, r);
  }

  // 2. Toasts e Alertas
  // toast({ variant: "destructive", title: "Erro", description: "..." }) -> "Ocorreu um erro ao processar sua solicitação."
  // Vamos usar regex para capturar as props do toast e substituir a description se for Erro/Sucesso generico.
  // E também o title para ficar padrão.
  
  // Padronizar toast de erro
  content = content.replace(
    /toast\(\{\s*variant:\s*["']destructive["'],\s*title:\s*["'][^"']+["'],\s*description:\s*["'][^"']+["']\s*\}\)/g,
    'toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })'
  );
  content = content.replace(
    /toast\(\{\s*variant:\s*["']destructive["'],\s*title:\s*["'][^"']+["']\s*\}\)/g,
    'toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })'
  );

  // Padronizar toast de sucesso (criar, atualizar, excluir)
  content = content.replace(
    /toast\(\{\s*title:\s*["'](?:Criado|Adicionado|Sucesso)[^"']*["'],\s*description:\s*["'][^"']+["']\s*\}\)/gi,
    'toast({ title: "Sucesso", description: "Registro criado com sucesso." })'
  );
  content = content.replace(
    /toast\(\{\s*title:\s*["'](?:Atualizado|Salvo|Editado)[^"']*["'],\s*description:\s*["'][^"']+["']\s*\}\)/gi,
    'toast({ title: "Sucesso", description: "Registro atualizado com sucesso." })'
  );
  content = content.replace(
    /toast\(\{\s*title:\s*["'](?:Exclu[ií]do|Removido|Deletado)[^"']*["'],\s*description:\s*["'][^"']+["']\s*\}\)/gi,
    'toast({ title: "Sucesso", description: "Registro excluído com sucesso." })'
  );
  // Fallback para outros toasts de sucesso genérico
  content = content.replace(
    /toast\(\{\s*title:\s*["']Sucesso["'],\s*description:\s*["'][^"']+["']\s*\}\)/g,
    'toast({ title: "Sucesso", description: "Operação realizada com sucesso." })'
  );

  // 3. Date Locale
  // Ensure date-fns format uses ptBR locale
  // Look for format(..., 'dd/MM/yyyy') without locale and add it if ptBR is imported
  if (content.includes('format(')) {
    if (!content.includes('ptBR')) {
      // Very naive addition of ptBR import if missing, normally we would parse AST
      if (content.includes('date-fns')) {
        content = content.replace(/from 'date-fns'/g, "from 'date-fns';\nimport { ptBR } from 'date-fns/locale'");
        content = content.replace(/from "date-fns"/g, 'from "date-fns";\nimport { ptBR } from "date-fns/locale"');
      }
    }
    // Modify format calls
    content = content.replace(/format\(([^,]+),\s*(['"]dd\/MM\/yyyy['"])\)/g, 'format($1, $2, { locale: ptBR })');
    content = content.replace(/format\(([^,]+),\s*(['"]P['"])\)/g, 'format($1, "dd/MM/yyyy", { locale: ptBR })');
    content = content.replace(/format\(([^,]+),\s*(['"]dd\/MM\/yyyy HH:mm['"])\)/g, 'format($1, $2, { locale: ptBR })');
  }

  // Encodings fix for previously unidentified chars
  content = content.replace(/M\uFFFDdulo/g, 'Módulo');
  content = content.replace(/sincroniza\uFFFD\uFFFDo/g, 'sincronização');
  content = content.replace(/estar\uFFFD/g, 'estará');
  content = content.replace(/dispon\uFFFDvel/g, 'disponível');
  content = content.replace(/anivers\uFFFDrios/g, 'aniversários');
  content = content.replace(/Respons\uFFFD\uFFFDvel/g, 'Responsável');
  content = content.replace(/A\uFFFD\uFFFD\uFFFDo/g, 'Ação');
  content = content.replace(/Balc\uFFFD\uFFFDo/g, 'Balcão');
  content = content.replace(/Sa\uFFFD\uFFFDda/g, 'Saída');
  content = content.replace(/hist\uFFFD\uFFFDrico/g, 'histórico');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Padronizado: ${filePath}`);
  }
});

console.log('Padronização e tradução concluída!');
