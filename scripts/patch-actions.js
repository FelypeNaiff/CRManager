const fs = require('fs');

let content = fs.readFileSync('src/lib/crm/actions.ts', 'utf-8');

// 1. Add serialize
if (!content.includes('const serialize =')) {
    content = content.replace("import { z } from 'zod';", "import { z } from 'zod';\n\nconst serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));");
}

// 2. Wrap all data: X with serialize(X)
content = content.replace(/return \{\s*success: true,\s*data:\s*([^}]+?)\s*\};/g, "return { success: true, data: serialize($1) };");

// 3. Fix getBirthdayList
content = content.replace(/return \{\s*success: true,\s*customers:\s*(.*?),\s*children:\s*(.*?),\s*\};/g, "return { success: true, customers: serialize($1), children: serialize($2) };");

// 4. Re-apply RBAC fixes for Tags
content = content.replace(
  /export async function createTag\(name: string, color\?: string\) \{\n  const session = await requirePermission\('CRM', 'VIEW'\);/g,
  "export async function createTag(name: string, color?: string) {\n  const session = await requirePermission('CLIENTES', 'UPDATE');"
);

content = content.replace(
  /export async function deleteTag\(id: string\) \{\n  const session = await requirePermission\('CRM', 'VIEW'\);/g,
  "export async function deleteTag(id: string) {\n  const session = await requirePermission('CLIENTES', 'DELETE');"
);

fs.writeFileSync('src/lib/crm/actions.ts', content, 'utf-8');
console.log('actions.ts patched successfully!');
