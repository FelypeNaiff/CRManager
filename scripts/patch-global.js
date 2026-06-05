const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') && !file.includes('serialize.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src/lib');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  if (!content.includes('use server')) continue;

  let changed = false;

  // 1. Remove internal serialize
  if (content.includes('const serialize = (obj: any)')) {
    content = content.replace(/const serialize = \(obj: any\) => JSON\.parse\(JSON\.stringify[^\n]+;/g, '');
    changed = true;
  }
  
  if (content.includes('const serialize = (obj: any)')) {
    content = content.replace(/const serialize = [^\n]+;/g, '');
    changed = true;
  }

  // Replace any old serialize( calls with serializePrisma(
  if (content.includes('serialize(')) {
    content = content.replace(/\bserialize\(/g, 'serializePrisma(');
    changed = true;
  }

  // 2. Add import for serializePrisma if needed
  if (!content.includes("import { serializePrisma }") && !content.includes("import { serializePrisma }")) {
    // try to put it after use server
    content = content.replace(/('|")use server('|");?/, "'use server';\nimport { serializePrisma } from '@/lib/serialize';");
    changed = true;
  }

  // 3. Remove export from zod schemas and consts (except arrow functions if they are meant to be exported? No, "use server" only allows async function exports)
  // Find `export const SomethingSchema = ...`
  const exportConsts = content.match(/export const [a-zA-Z0-9_]+ =/g);
  if (exportConsts) {
    for (const ec of exportConsts) {
      content = content.replace(ec, ec.replace('export const ', 'const '));
      changed = true;
    }
  }

  // 4. Wrap returning data with serializePrisma
  // General data: ...
  const regex = /return\s*\{\s*success:\s*true\s*,\s*data:\s*([^}]+?)\s*\};/g;
  content = content.replace(regex, (match, p1) => {
    // If it's already wrapped, don't wrap again
    if (p1.startsWith('serializePrisma(')) return match;
    changed = true;
    return `return { success: true, data: serializePrisma(${p1}) };`;
  });

  // Specific arrays or other returns
  if (content.includes('return { success: true, customers:')) {
    content = content.replace(/return\s*\{\s*success:\s*true\s*,\s*customers:\s*(.*?),\s*children:\s*(.*?)\s*\};/g, (match, p1, p2) => {
      let r1 = p1.startsWith('serializePrisma(') ? p1 : `serializePrisma(${p1})`;
      let r2 = p2.startsWith('serializePrisma(') ? p2 : `serializePrisma(${p2})`;
      changed = true;
      return `return { success: true, customers: ${r1}, children: ${r2} };`;
    });
  }
  
  if (content.includes('return { success: true, data: { clientes:')) {
    content = content.replace(/return\s*\{\s*success:\s*true\s*,\s*data:\s*\{\s*clientes:\s*mappedClients,\s*stats,\s*tags\s*\}\s*\};/g, () => {
      changed = true;
      return `return { success: true, data: serializePrisma({ clientes: mappedClients, stats, tags }) };`;
    });
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`Patched ${file}`);
  }
}
