const fs = require('fs');

const path = 'src/app/configuracoes/usuarios/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/{can\('USUARIOS', 'DELETE'\) && <Button variant="outline" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={\(\) => handleOpenDelete\(user.id\)} title="Excluir Usuário">\r?\n\s*<Trash2 className="h-4 w-4" \/>\r?\n\s*<\/Button>}/g, 
`<Button variant="outline" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleOpenDelete(user.id)} title="Excluir Usuário">\n                          <Trash2 className="h-4 w-4" />\n                        </Button>`);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
