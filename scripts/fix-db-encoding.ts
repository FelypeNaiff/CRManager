import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Flag de Dry Run
const isDryRun = process.env.DRY_RUN !== 'false';

// Função auxiliar para substituir caracteres com encoding quebrado
function fixEncoding(text: string | null): string | null {
  if (!text) return text;
  
  // Substituições mapeadas
  let fixedText = text
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã\xad/g, 'í') // Ã seguido do char \xad
    .replace(/Ãµ/g, 'õ')
    .replace(/Ã¢/g, 'â')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã§Ã£o/g, 'ção')
    .replace(/Ãµes/g, 'ões')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ãƒ/g, 'Ã')
    .replace(/Ã•/g, 'Õ')
    .replace(/Â/g, '') // Geralmente Â aparece antes de certos caracteres, pode ser limpado se sobrar
    .replace(/\uFFFD/g, ''); // Remove replacement character

  return fixedText !== text ? fixedText : null;
}

// Relatório
const report: Record<string, { field: string; count: number; preview: { before: string; after: string }[] }[]> = {};

async function processTable(tableName: string, modelName: any, fieldsToFix: string[]) {
  const model = prisma[modelName as keyof typeof prisma] as any;
  if (!model) {
    console.warn(`[Aviso] Modelo ${modelName} não encontrado no Prisma.`);
    return;
  }

  try {
    const records = await model.findMany();
    
    for (const record of records) {
      const updates: Record<string, string> = {};
      
      for (const field of fieldsToFix) {
        if (typeof record[field] === 'string') {
          const fixedValue = fixEncoding(record[field]);
          
          if (fixedValue) {
            updates[field] = fixedValue;
            
            if (!report[tableName]) report[tableName] = [];
            let fieldReport = report[tableName].find(r => r.field === field);
            if (!fieldReport) {
              fieldReport = { field, count: 0, preview: [] };
              report[tableName].push(fieldReport);
            }
            
            fieldReport.count++;
            if (fieldReport.preview.length < 3) {
              fieldReport.preview.push({ before: record[field], after: fixedValue });
            }
          }
        }
      }
      
      if (Object.keys(updates).length > 0 && !isDryRun) {
        // Encontra a chave primária
        const idField = record.id ? 'id' : (record.companyId && record.name ? { companyId_name: { companyId: record.companyId, name: record.name } } : null);
        
        if (record.id) {
          await model.update({
            where: { id: record.id },
            data: updates
          });
        } else {
          console.warn(`[Aviso] Tabela ${tableName} não possui id suportado, atualização falhou para o registro.`, updates);
        }
      }
    }
  } catch (err) {
    console.error(`Erro ao processar tabela ${tableName}:`, err);
  }
}

async function main() {
  console.log('==================================================');
  console.log(`🚀 INICIANDO SCRIPT DE CORREÇÃO DE ENCODING (DRY_RUN: ${isDryRun})`);
  console.log('==================================================\n');

  // Mapeamento de tabelas e campos string
  await processTable('customers', 'customer', ['name', 'notes']);
  await processTable('customer_children', 'customerChild', ['name', 'notes']);
  await processTable('customer_tags', 'customerTag', ['name']);
  await processTable('customer_histories', 'customerHistory', ['description']);
  await processTable('customer_interactions', 'customerInteraction', ['notes']);
  await processTable('products', 'product', ['name', 'description']);
  await processTable('product_categories', 'productCategory', ['name', 'description']);
  await processTable('suppliers', 'supplier', ['name']);
  await processTable('users', 'user', ['name', 'cargo']);
  await processTable('roles', 'role', ['name', 'description']);
  
  // Exibição do relatório
  console.log('\n==================================================');
  console.log('📊 RELATÓRIO DE ALTERAÇÕES');
  console.log('==================================================');
  
  if (Object.keys(report).length === 0) {
    console.log('✅ Nenhum dado com encoding quebrado foi encontrado nas tabelas verificadas.');
  } else {
    for (const [table, fields] of Object.entries(report)) {
      console.log(`\n📁 Tabela: ${table}`);
      for (const fieldData of fields) {
        console.log(`  🔹 Campo: ${fieldData.field} (${fieldData.count} registros afetados)`);
        console.log(`     Previews:`);
        fieldData.preview.forEach((p, i) => {
          console.log(`       [${i+1}] Antes: "${p.before}"`);
          console.log(`           Depois: "${p.after}"`);
        });
      }
    }
  }
  
  console.log('\n==================================================');
  if (isDryRun) {
    console.log('⚠️  MODO DRY RUN: Nenhuma alteração foi salva no banco de dados.');
    console.log('👉  Para aplicar as correções, execute: DRY_RUN=false npm run fix:encoding');
  } else {
    console.log('✅  CORREÇÕES APLICADAS NO BANCO DE DADOS COM SUCESSO!');
  }
  console.log('==================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
