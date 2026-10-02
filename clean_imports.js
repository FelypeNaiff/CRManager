const fs = require('fs');
let p = 'src/app/(dashboard)/produtos/page.tsx';
let content = fs.readFileSync(p, 'utf8');
content = content.replace(/import \{ useCollection, useFirestore, useMemoFirebase \} from "@\/lib\/legacy-stubs"\r?\n/g, '');
content = content.replace(/import \{ collection, query, orderBy \} from "@\/lib\/legacy-firestore-stubs"\r?\n/g, '');
fs.writeFileSync(p, content, 'utf8');

let p2 = 'src/components/layout/app-sidebar.tsx';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(/import \{ useFirestore, useDoc, useMemoFirebase \} from "@\/lib\/legacy-stubs"\r?\n/g, '');
c2 = c2.replace(/import \{ doc \} from "@\/lib\/legacy-firestore-stubs"\r?\n/g, '');
fs.writeFileSync(p2, c2, 'utf8');

console.log('Cleaned up imports');
