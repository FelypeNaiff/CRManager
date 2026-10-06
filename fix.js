const fs = require('fs');
const path = './src/app/(dashboard)/produtos/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Breadcrumb
content = content.replace(
  /<span className="mx-2\">-<\/span>\s*<span className=\"cursor-pointer hover:underline\">Produtos<\/span>\s*<span className=\"mx-2\">-<\/span>/g, 
  '<span className="mx-2">&gt;</span>\\n        <span className="cursor-pointer hover:underline">Produtos</span>\\n        <span className="mx-2">&gt;</span>'
);

// Adicionar button
content = content.replace('className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]"', 'className="bg-[#1e2229] hover:bg-black text-white gap-1 h-8 rounded-sm px-3 text-[13px]"');

// Dropdown mais ações
const oldDrop = `<DropdownMenuItem onClick={() => router.push('/produtos/importar-planilha')}><FileSpreadsheet className="h-4 w-4 mr-2" /> Importar de uma planilha</DropdownMenuItem>
              <DropdownMenuItem><FileText className="h-4 w-4 mr-2" /> Importar de notas fiscais</DropdownMenuItem>
              <DropdownMenuItem><Download className="h-4 w-4 mr-2" /> Exportar cadastros</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><DollarSign className="h-4 w-4 mr-2" /> Ajustar valores em massa</DropdownMenuItem>
              <DropdownMenuItem><Package className="h-4 w-4 mr-2" /> Ajustar produtos em massa</DropdownMenuItem>
              <DropdownMenuItem><TagIcon className="h-4 w-4 mr-2" /> Gerar etiquetas</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" /> Excluir produtos</DropdownMenuItem>`;

const newDrop = `<DropdownMenuItem onClick={() => router.push('/produtos/importar-planilha')}><FileSpreadsheet className="h-4 w-4 mr-2" /> Importar de uma planilha</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/produtos/etiquetas/gerar')}><TagIcon className="h-4 w-4 mr-2" /> Gerar etiquetas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/produtos/grades')}><Layers className="h-4 w-4 mr-2" /> Grades e variações</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/produtos/grupos')}><Package className="h-4 w-4 mr-2" /> Grupos de produto</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" /> Excluir selecionados</DropdownMenuItem>`;

content = content.replace(oldDrop, newDrop);

// Search input placeholder
content = content.replace('placeholder="Pesquisar..."', 'placeholder="Buscar"');

// Search Button
content = content.replace('className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0"', 'className="bg-[#1e2229] hover:bg-black text-white h-8 w-8 p-0 rounded-sm shrink-0"');

// Table Header Value -> Vr. varejo
content = content.replace("Valor {renderSortIcon('valor')}", "Vr. varejo {renderSortIcon('valor')}");

// Layers
if(!content.includes('Layers,')) {
  content = content.replace('lucide-react"', 'Layers } from "lucide-react"');
  content = content.replace(' } from "Layers } from "lucide-react"', ', Layers } from "lucide-react"');
}

fs.writeFileSync(path, content);
console.log('Done!');
