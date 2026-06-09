import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();
const IMPORTS_DIR = path.join(__dirname, '../imports');

interface ValidationIssue {
  sheet: string;
  row: number | string;
  identifier: string;
  type: 'ERROR' | 'WARNING';
  message: string;
}

function parseNumber(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(',', '.').trim());
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function validateImports() {
  console.log("==================================================");
  console.log("NEEX IMPORT VALIDATION & PREVIEW TOOL (GO-LIVE-04B)");
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database. Run seeding first.");
    process.exit(1);
  }

  if (!fs.existsSync(IMPORTS_DIR)) {
    console.log(`Creating imports directory at: ${IMPORTS_DIR}`);
    fs.mkdirSync(IMPORTS_DIR, { recursive: true });
    console.log("Please place your Excel files (produtos.xlsx, clientes.xlsx, vendedores.xlsx) in this directory.");
    return;
  }

  const issues: ValidationIssue[] = [];
  const previewReportWb = XLSX.utils.book_new();

  // 1. PRODUCTS PREVIEW & VALIDATION
  const produtosPath = path.join(IMPORTS_DIR, 'produtos.xlsx');
  const productsPreviewData: any[][] = [['Linha', 'Identificador (SKU/Barcode)', 'Nome', 'Status', 'Mensagem']];
  
  if (fs.existsSync(produtosPath)) {
    console.log("Validating and previewing products spreadsheet...");
    const workbook = XLSX.readFile(produtosPath);
    const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("produto")) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length > 1) {
      const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "");
      const idx = {
        codigo: headers.findIndex(h => h.toLowerCase().includes("código") && !h.toLowerCase().includes("barra")),
        estoque: headers.findIndex(h => h.toLowerCase().includes("estoque") || h.toLowerCase().includes("qtd")),
        nome: headers.findIndex(h => h.toLowerCase().includes("nome")),
        compra: headers.findIndex(h => h.toLowerCase().includes("compra") || h.toLowerCase().includes("custo")),
        venda: headers.findIndex(h => h.toLowerCase().includes("venda") || h.toLowerCase().includes("preço")),
        barras: headers.findIndex(h => h.toLowerCase().includes("barras") || h.toLowerCase().includes("gtin") || h.toLowerCase().includes("ean")),
        sku: headers.findIndex(h => h.toLowerCase().includes("sku")),
      };

      const skuMap = new Map<string, number[]>();
      const barcodeMap = new Map<string, number[]>();

      // First pass: count frequencies in sheet
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;
        const sku = idx.sku !== -1 ? row[idx.sku]?.toString().trim() : "";
        const barcode = idx.barras !== -1 ? row[idx.barras]?.toString().trim() : "";
        if (sku) {
          if (!skuMap.has(sku)) skuMap.set(sku, []);
          skuMap.get(sku)!.push(i + 1);
        }
        if (barcode) {
          if (!barcodeMap.has(barcode)) barcodeMap.set(barcode, []);
          barcodeMap.get(barcode)!.push(i + 1);
        }
      }

      // Second pass: lookup in DB and validate
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

        const rowNum = i + 1;
        const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : "";
        const sku = idx.sku !== -1 ? row[idx.sku]?.toString().trim() || "" : "";
        const barcode = idx.barras !== -1 ? row[idx.barras]?.toString().trim() || "" : "";
        const internalCode = idx.codigo !== -1 ? row[idx.codigo]?.toString().trim() || "" : "";
        const estoque = idx.estoque !== -1 ? parseNumber(row[idx.estoque]) : 0;
        const compra = idx.compra !== -1 ? parseNumber(row[idx.compra]) : 0;
        const venda = idx.venda !== -1 ? parseNumber(row[idx.venda]) : 0;

        let status: 'Novo' | 'Atualizado' | 'Rejeitado' = 'Novo';
        let msg = 'Produto/Variante novo. Será criado.';

        if (!nome) {
          status = 'Rejeitado';
          msg = 'Nome do produto é obrigatório.';
          issues.push({ sheet: 'Produtos', row: rowNum, identifier: `Linha ${rowNum}`, type: 'ERROR', message: msg });
        } else if (venda <= 0) {
          status = 'Rejeitado';
          msg = `Preço de venda inválido ou zerado (R$ ${venda}).`;
          issues.push({ sheet: 'Produtos', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
        } else if (compra <= 0) {
          status = 'Rejeitado';
          msg = `Preço de compra/custo inválido ou zerado (R$ ${compra}).`;
          issues.push({ sheet: 'Produtos', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
        } else if (estoque < 0) {
          status = 'Rejeitado';
          msg = `Estoque negativo detectado (${estoque}).`;
          issues.push({ sheet: 'Produtos', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
        } else if (sku && skuMap.get(sku) && skuMap.get(sku)!.length > 1) {
          status = 'Rejeitado';
          msg = `SKU duplicado na planilha nas linhas: ${skuMap.get(sku)!.join(', ')}`;
          issues.push({ sheet: 'Produtos', row: rowNum, identifier: `SKU: ${sku}`, type: 'ERROR', message: msg });
        } else if (barcode && barcodeMap.get(barcode) && barcodeMap.get(barcode)!.length > 1) {
          status = 'Rejeitado';
          msg = `Código de barras duplicado na planilha nas linhas: ${barcodeMap.get(barcode)!.join(', ')}`;
          issues.push({ sheet: 'Produtos', row: rowNum, identifier: `Barcode: ${barcode}`, type: 'ERROR', message: msg });
        } else {
          // Verify existence in DB
          let existingVariant: any = null;
          if (sku) {
            existingVariant = await prisma.productVariant.findFirst({
              where: { companyId: company.id, sku }
            });
          }
          if (!existingVariant && barcode) {
            existingVariant = await prisma.productVariant.findFirst({
              where: { companyId: company.id, barcode }
            });
          }
          if (!existingVariant && internalCode) {
            existingVariant = await prisma.productVariant.findFirst({
              where: { companyId: company.id, product: { internalCode } }
            });
          }

          if (existingVariant) {
            status = 'Atualizado';
            msg = 'Produto/Variante já cadastrado. Atributos e estoques serão atualizados via delta.';
          }
        }

        productsPreviewData.push([rowNum, sku || barcode || internalCode || `Linha ${rowNum}`, nome || 'Sem Nome', status, msg]);
      }
    }
  } else {
    console.log(`[!] File not found: ${produtosPath}. Skipping product validation.`);
  }

  // 2. CLIENTES PREVIEW & VALIDATION
  const clientesPath = path.join(IMPORTS_DIR, 'clientes.xlsx');
  const clientesPreviewData: any[][] = [['Linha', 'Nome', 'Telefone', 'Status', 'Mensagem']];
  const rejectedClients: any[][] = [['Nome', 'Telefone', 'Motivo Rejeição']];

  if (fs.existsSync(clientesPath)) {
    console.log("Validating and previewing CRM clientes spreadsheet...");
    const workbook = XLSX.readFile(clientesPath);
    const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("cliente")) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length > 1) {
      const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "");
      const idx = {
        nome: headers.findIndex(h => h.toLowerCase().includes("nome")),
        telefone: headers.findIndex(h => h.toLowerCase().includes("telefone") || h.toLowerCase().includes("celular")),
        nascimento: headers.findIndex(h => h.toLowerCase().includes("nascimento") || h.toLowerCase().includes("aniversario")),
      };

      const phoneMap = new Map<string, number[]>();

      // First pass: count frequencies
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;
        const phone = idx.telefone !== -1 ? row[idx.telefone]?.toString().trim().replace(/\D/g, '') : "";
        if (phone) {
          if (!phoneMap.has(phone)) phoneMap.set(phone, []);
          phoneMap.get(phone)!.push(i + 1);
        }
      }

      // Second pass: check DB and validate
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

        const rowNum = i + 1;
        const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : "";
        const rawPhone = idx.telefone !== -1 ? row[idx.telefone]?.toString().trim() : "";
        const phone = rawPhone.replace(/\D/g, '');
        const nascimento = idx.nascimento !== -1 ? row[idx.nascimento] : null;

        let status: 'Novo' | 'Duplicado' | 'Rejeitado' = 'Novo';
        let msg = 'Cliente novo. Será importado com carteira.';

        if (!nome) {
          status = 'Rejeitado';
          msg = 'Nome do cliente é obrigatório.';
          issues.push({ sheet: 'Clientes', row: rowNum, identifier: `Linha ${rowNum}`, type: 'ERROR', message: msg });
        } else if (!phone) {
          status = 'Rejeitado';
          msg = 'Telefone do cliente é obrigatório.';
          issues.push({ sheet: 'Clientes', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
        } else if (phone.length < 10) {
          status = 'Rejeitado';
          msg = `Telefone com formato inválido: '${rawPhone}'`;
          issues.push({ sheet: 'Clientes', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
        } else if (phoneMap.get(phone) && phoneMap.get(phone)!.length > 1) {
          status = 'Duplicado';
          msg = `Telefone duplicado na planilha nas linhas: ${phoneMap.get(phone)!.join(', ')}`;
          issues.push({ sheet: 'Clientes', row: rowNum, identifier: `Telefone: ${phone}`, type: 'ERROR', message: msg });
          rejectedClients.push([nome, rawPhone, msg]);
        } else {
          // Check DB
          const existingDb = await prisma.customer.findFirst({
            where: { companyId: company.id, phone }
          });
          if (existingDb) {
            status = 'Rejeitado';
            msg = `Telefone já cadastrado no banco (Cliente: ${existingDb.name}). Pulanado.`;
            issues.push({ sheet: 'Clientes', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
            rejectedClients.push([nome, rawPhone, msg]);
          } else if (!nascimento) {
            issues.push({ sheet: 'Clientes', row: rowNum, identifier: nome, type: 'WARNING', message: 'Data de nascimento em branco (será importada como null).' });
          }
        }

        clientesPreviewData.push([rowNum, nome || 'Sem Nome', rawPhone || 'Sem Telefone', status, msg]);
      }
    }
  } else {
    console.log(`[!] File not found: ${clientesPath}. Skipping CRM validation.`);
  }

  // 3. SELLERS PREVIEW & VALIDATION
  const vendedoresPath = path.join(IMPORTS_DIR, 'vendedores.xlsx');
  const vendedoresPreviewData: any[][] = [['Linha', 'Nome', 'Status', 'Mensagem']];

  if (fs.existsSync(vendedoresPath)) {
    console.log("Validating and previewing sellers spreadsheet...");
    const workbook = XLSX.readFile(vendedoresPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length > 1) {
      const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "");
      const idx = {
        nome: headers.findIndex(h => h.toLowerCase().includes("nome")),
        comissao: headers.findIndex(h => h.toLowerCase().includes("comissão") || h.toLowerCase().includes("taxa") || h.toLowerCase().includes("porcentagem")),
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

        const rowNum = i + 1;
        const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : "";
        const comissao = idx.comissao !== -1 ? parseNumber(row[idx.comissao]) : -1;

        let status: 'Novo' | 'Atualizado' | 'Rejeitado' = 'Novo';
        let msg = 'Vendedor novo. Será criado.';

        if (!nome) {
          status = 'Rejeitado';
          msg = 'Nome do vendedor é obrigatório.';
          issues.push({ sheet: 'Vendedores', row: rowNum, identifier: `Linha ${rowNum}`, type: 'ERROR', message: msg });
        } else if (comissao < 0) {
          status = 'Rejeitado';
          msg = `Vendedor sem taxa de comissão definida ou comissão inválida.`;
          issues.push({ sheet: 'Vendedores', row: rowNum, identifier: nome, type: 'ERROR', message: msg });
        } else {
          // Check DB
          const seller = await prisma.seller.findFirst({
            where: { companyId: company.id, name: nome }
          });
          if (seller) {
            status = 'Atualizado';
            msg = `Vendedor já existe no banco. Será atualizada taxa de comissão e metas do mês.`;
          }
        }

        vendedoresPreviewData.push([rowNum, nome || 'Sem Nome', status, msg]);
      }
    }
  } else {
    console.log(`[!] File not found: ${vendedoresPath}. Skipping sellers validation.`);
  }

  // 4. FINANCIAL PREVIEW (Conta Corrente, Caixa Físico, Plano de contas, Centro de Custos)
  console.log("Validating and previewing Financial initialization...");
  const financialPreviewData: any[][] = [['Tipo', 'Nome/Código', 'Status', 'Mensagem']];

  // Bank Account
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { companyId: company.id, isCashAccount: false }
  });
  financialPreviewData.push([
    'Conta Bancária',
    'Conta Corrente Principal',
    bankAccount ? 'Já Existente' : 'Criada',
    bankAccount ? 'Conta corrente já configurada.' : 'Será criada conta corrente principal.'
  ]);

  // Cash Account
  const cashBankAccount = await prisma.bankAccount.findFirst({
    where: { companyId: company.id, isCashAccount: true }
  });
  financialPreviewData.push([
    'Caixa Físico',
    'Caixa Físico da Loja',
    cashBankAccount ? 'Já Existente' : 'Criada',
    cashBankAccount ? 'Caixa físico já configurado.' : 'Será criado caixa físico da loja com saldo inicial R$ 500.'
  ]);

  // Plano de Contas
  const accountsToVerify = ["1", "1.1", "2", "2.1", "3", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"];
  for (const code of accountsToVerify) {
    const acc = await prisma.financialAccount.findUnique({
      where: { companyId_code: { companyId: company.id, code } }
    });
    financialPreviewData.push([
      'Plano de Contas',
      `Conta Código: ${code}`,
      acc ? 'Já Existente' : 'Criada',
      acc ? 'Conta contábil já existe no plano.' : `Será criada conta contábil código ${code}.`
    ]);
  }

  // Cost Center
  const ccVerify = ["Administração", "Comercial / Loja"];
  for (const name of ccVerify) {
    const cc = await prisma.costCenter.findUnique({
      where: { companyId_name: { companyId: company.id, name } }
    });
    financialPreviewData.push([
      'Centro de Custo',
      name,
      cc ? 'Já Existente' : 'Criada',
      cc ? 'Centro de custo já configurado.' : `Será criado centro de custo '${name}'.`
    ]);
  }

  // 5. OUTPUT PREVIEW SHEETS
  XLSX.utils.book_append_sheet(previewReportWb, XLSX.utils.aoa_to_sheet(productsPreviewData), "Produtos");
  XLSX.utils.book_append_sheet(previewReportWb, XLSX.utils.aoa_to_sheet(clientesPreviewData), "Clientes");
  XLSX.utils.book_append_sheet(previewReportWb, XLSX.utils.aoa_to_sheet(vendedoresPreviewData), "Vendedores");
  XLSX.utils.book_append_sheet(previewReportWb, XLSX.utils.aoa_to_sheet(financialPreviewData), "Financeiro");

  // If there are errors or warnings, output them
  const errors = issues.filter(i => i.type === 'ERROR');
  const warnings = issues.filter(i => i.type === 'WARNING');

  console.log("\n==================================================");
  console.log("VALIDATION SUMMARY:");
  console.log("==================================================");
  console.log(`Critical Errors   : ${errors.length}`);
  console.log(`Warnings          : ${warnings.length}`);
  console.log("==================================================");

  if (issues.length > 0) {
    console.log("\nDetails of Issues:");
    issues.forEach(i => {
      console.log(`  [${i.type}] Planilha: ${i.sheet} | Linha: ${i.row} | Alvo: ${i.identifier} | ${i.message}`);
    });
    console.log("==================================================");
  }

  // Append inconsistency sheet to preview workbook
  const inconsistencyData: any[][] = [['Planilha', 'Linha', 'Identificador', 'Tipo', 'Mensagem']];
  if (issues.length > 0) {
    issues.forEach(i => inconsistencyData.push([i.sheet, i.row, i.identifier, i.type, i.message]));
  }
  XLSX.utils.book_append_sheet(previewReportWb, XLSX.utils.aoa_to_sheet(inconsistencyData), "Inconsistências");

  const previewReportPath = path.join(IMPORTS_DIR, 'import-validation-report.xlsx');
  XLSX.writeFile(previewReportWb, previewReportPath);
  console.log(`[!] Relatório de preview gerado em: ${previewReportPath}`);

  // Also standalone clientes_rejeitados.xlsx
  if (rejectedClients.length > 1) {
    const rejectedWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(rejectedWb, XLSX.utils.aoa_to_sheet(rejectedClients), "Rejeitados");
    const rejectedPath = path.join(IMPORTS_DIR, 'clientes_rejeitados.xlsx');
    XLSX.writeFile(rejectedWb, rejectedPath);
    console.log(`[!] Relatório de clientes rejeitados gerado em: ${rejectedPath}`);
  }

  // 6. DB WRITE / REAL IMPORT STAGE
  const confirmImportEnv = process.env.CONFIRM_IMPORT === 'true';

  if (confirmImportEnv) {
    if (errors.length > 0) {
      console.error("\n[FAIL] Planilha com erros críticos. Abortando gravação real.");
      console.error("  -> Corrija as inconsistências listadas no relatório antes de prosseguir.");
      process.exit(1);
    }

    console.log("\n==================================================");
    console.log("CONFIRM_IMPORT=true DETECTED. EXECUTING REAL DB WRITES...");
    console.log("==================================================");

    try {
      console.log("\nFase 1: Importação Financeira...");
      execSync('npx tsx scripts/import-financial-data.ts', { stdio: 'inherit' });

      console.log("\nFase 2: Importação de Produtos...");
      execSync('npx tsx scripts/import-products-data.ts', { stdio: 'inherit' });

      console.log("\nFase 3: Importação CRM...");
      execSync('npx tsx scripts/import-crm-data.ts', { stdio: 'inherit' });

      console.log("\nFase 4: Importação Comercial...");
      execSync('npx tsx scripts/import-sellers-data.ts', { stdio: 'inherit' });

      console.log("\nFase 5: Executando diagnose-go-live...");
      execSync('npx tsx scripts/diagnose-go-live.ts', { stdio: 'inherit' });

      console.log("\nFase 6: Rodando suítes de teste de integração (PDV & Auditoria Financeira)...");
      execSync('npx tsx scripts/test-pdv-flow.ts', { stdio: 'inherit' });
      execSync('npx tsx scripts/test-financial-audit.ts', { stdio: 'inherit' });

      console.log("\n==================================================");
      console.log("🟢 CARGA REAL CONCLUÍDA E VALIDADA COM SUCESSO!");
      console.log("==================================================");
    } catch (err: any) {
      console.error("\n🔴 FALHA CRÍTICA DURANTE A GRAVAÇÃO REAL:");
      console.error(err.message);
      process.exit(1);
    }
  } else {
    console.log("\n[DRY RUN] Nenhuma alteração foi salva no banco de dados.");
    console.log("Para rodar a importação real definitiva, use o comando:");
    console.log("  $env:CONFIRM_IMPORT=\"true\"; npx tsx scripts/validate-imports.ts");
    console.log("==================================================");
  }
}

validateImports()
  .catch(err => {
    console.error("Critical error in validateImports:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
