const fs = require('fs');
const file = 'src/app/configuracoes/usuarios/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const actionButtonsRegex = /(<Button variant="outline" size="icon" className="h-8 w-8" onClick=\{\(\) => handleOpenEdit\(user\.id\)\} title="Editar Usuário">\s*<Edit2 className="h-4 w-4" \/>\s*<\/Button>\})/;
const actionButtonsReplacement = `$1\n                        {can('USUARIOS', 'DELETE') && <Button variant="outline" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleOpenDelete(user.id)} title="Excluir Usuário">\n                          <Trash2 className="h-4 w-4" />\n                        </Button>}`;

code = code.replace(actionButtonsRegex, actionButtonsReplacement);

const dialogsRegex = /(<ResetPinDialog[\s\S]*?\/>)/;
const dialogsReplacement = `$1\n      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>\n        <AlertDialogContent className="bg-white">\n          <AlertDialogHeader>\n            <AlertDialogTitle className="font-bold text-rose-700 flex items-center gap-2">\n              <Trash2 className="h-5 w-5" /> Excluir Usuário\n            </AlertDialogTitle>\n            <AlertDialogDescription>\n              Tem certeza que deseja excluir este usuário? O histórico de ações dele será mantido, mas o acesso ao sistema será revogado imediatamente. Esta ação não pode ser desfeita.\n            </AlertDialogDescription>\n          </AlertDialogHeader>\n          <AlertDialogFooter>\n            <AlertDialogCancel>Cancelar</AlertDialogCancel>\n            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-600" onClick={handleDelete}>\n              Sim, Excluir\n            </AlertDialogAction>\n          </AlertDialogFooter>\n        </AlertDialogContent>\n      </AlertDialog>`;

code = code.replace(dialogsRegex, dialogsReplacement);

fs.writeFileSync(file, code);
console.log("Patched successfully");
