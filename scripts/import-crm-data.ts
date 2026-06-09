import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const IMPORTS_DIR = path.join(__dirname, '../imports');

function parseNumber(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(',', '.').trim());
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function importCrmData() {
  console.log("==================================================");
  console.log("NEEX CRM IMPORT RUNNER (GO-LIVE-04)");
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database. Run seeding first.");
    process.exit(1);
  }

  const clientesPath = path.join(IMPORTS_DIR, 'clientes.xlsx');
  if (!fs.existsSync(clientesPath)) {
    console.error(`  [FAIL] CRM spreadsheet not found at: ${clientesPath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(clientesPath);
  
  // 1. Process Clientes
  const clientSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("cliente")) || workbook.SheetNames[0];
  const clientSheet = workbook.Sheets[clientSheetName];
  const clientRows: any[] = XLSX.utils.sheet_to_json(clientSheet, { header: 1 });

  if (clientRows.length <= 1) {
    console.error("  [FAIL] Clientes sheet is empty.");
    process.exit(1);
  }

  const clientHeaders: string[] = clientRows[0].map((h: any) => h?.toString().trim() || "");
  const cIdx = {
    nome: clientHeaders.findIndex(h => h.toLowerCase().includes("nome")),
    telefone: clientHeaders.findIndex(h => h.toLowerCase().includes("telefone") || h.toLowerCase().includes("celular")),
    email: clientHeaders.findIndex(h => h.toLowerCase().includes("e-mail") || h.toLowerCase().includes("email")),
    cpf: clientHeaders.findIndex(h => h.toLowerCase().includes("cpf")),
    nascimento: clientHeaders.findIndex(h => h.toLowerCase().includes("nascimento") || h.toLowerCase().includes("aniversario")),
    saldo: clientHeaders.findIndex(h => h.toLowerCase().includes("saldo") || h.toLowerCase().includes("carteira")),
  };

  const phoneCount = new Map<string, number>();
  // First pass: count phone numbers in the file to identify duplicates
  for (let i = 1; i < clientRows.length; i++) {
    const row = clientRows[i];
    if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;
    const phone = cIdx.telefone !== -1 ? row[cIdx.telefone]?.toString().trim().replace(/\D/g, '') : "";
    if (phone) {
      phoneCount.set(phone, (phoneCount.get(phone) || 0) + 1);
    }
  }

  let clientsMigrated = 0;
  let clientsSkipped = 0;

  console.log("Importing customers...");
  for (let i = 1; i < clientRows.length; i++) {
    const row = clientRows[i];
    if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

    const rowNum = i + 1;
    const nome = cIdx.nome !== -1 ? row[cIdx.nome]?.toString().trim() : "";
    const rawPhone = cIdx.telefone !== -1 ? row[cIdx.telefone]?.toString().trim() : "";
    const phone = rawPhone.replace(/\D/g, '');
    const email = cIdx.email !== -1 ? row[cIdx.email]?.toString().trim() || null : null;
    const cpf = cIdx.cpf !== -1 ? row[cIdx.cpf]?.toString().trim() || null : null;
    const nascimento = cIdx.nascimento !== -1 ? parseDate(row[cIdx.nascimento]) : null;
    const saldo = cIdx.saldo !== -1 ? parseNumber(row[cIdx.saldo]) : 0;

    if (!nome || !phone) {
      console.log(`  [SKIP] Linha ${rowNum}: Nome ou Telefone ausente.`);
      clientsSkipped++;
      continue;
    }

    // Rule: Reject duplicates inside the file
    if (phoneCount.get(phone)! > 1) {
      console.log(`  [REJECT/DUP] Cliente '${nome}' rejeitado por telefone duplicado no arquivo: '${rawPhone}'`);
      clientsSkipped++;
      continue;
    }

    // Rule: Skip if phone already exists in DB
    const existingDb = await prisma.customer.findFirst({
      where: { companyId: company.id, phone }
    });

    if (existingDb) {
      console.log(`  [SKIP/DB_DUP] Telefone '${rawPhone}' já existe no banco (Cliente: ${existingDb.name}). Pulanado.`);
      clientsSkipped++;
      continue;
    }

    // Parse Birthday parts
    let birthDay: number | null = null;
    let birthMonth: number | null = null;
    let birthYear: number | null = null;
    if (nascimento) {
      birthDay = nascimento.getUTCDate();
      birthMonth = nascimento.getUTCMonth() + 1;
      birthYear = nascimento.getUTCFullYear();
    }

    // Create customer and wallet
    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          companyId: company.id,
          name: nome,
          email,
          phone,
          cpf,
          birthDay,
          birthMonth,
          birthYear,
          status: "ativo"
        }
      });

      const wallet = await tx.customerWallet.create({
        data: {
          customerId: customer.id,
          balance: saldo
        }
      });

      if (saldo > 0) {
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            customerId: customer.id,
            type: "ADJUSTMENT",
            amount: saldo,
            balanceBefore: 0,
            balanceAfter: saldo,
            description: "Saldo Inicial - GO-LIVE-04"
          }
        });
      }
    });

    clientsMigrated++;
  }

  // 2. Process Children
  let childrenMigrated = 0;
  let childrenSkipped = 0;

  const childrenSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("filho"));
  if (childrenSheetName) {
    console.log("\nImporting children...");
    const childrenSheet = workbook.Sheets[childrenSheetName];
    const childrenRows: any[] = XLSX.utils.sheet_to_json(childrenSheet, { header: 1 });

    if (childrenRows.length > 1) {
      const childrenHeaders: string[] = childrenRows[0].map((h: any) => h?.toString().trim() || "");
      const childIdx = {
        nomeFilho: childrenHeaders.findIndex(h => h.toLowerCase().includes("filho")),
        telefonePai: childrenHeaders.findIndex(h => h.toLowerCase().includes("pai") || h.toLowerCase().includes("mãe") || h.toLowerCase().includes("telefone")),
        nascimentoFilho: childrenHeaders.findIndex(h => h.toLowerCase().includes("nascimento") || h.toLowerCase().includes("data")),
      };

      for (let i = 1; i < childrenRows.length; i++) {
        const row = childrenRows[i];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

        const rowNum = i + 1;
        const nomeFilho = childIdx.nomeFilho !== -1 ? row[childIdx.nomeFilho]?.toString().trim() : "";
        const rawPhonePai = childIdx.telefonePai !== -1 ? row[childIdx.telefonePai]?.toString().trim() : "";
        const phonePai = rawPhonePai.replace(/\D/g, '');
        const nascimentoFilho = childIdx.nascimentoFilho !== -1 ? parseDate(row[childIdx.nascimentoFilho]) : null;

        if (!nomeFilho || !phonePai) {
          console.log(`  [SKIP CHILD] Linha ${rowNum}: Nome do Filho ou Telefone do Pai ausente.`);
          childrenSkipped++;
          continue;
        }

        // Find parent in the database
        const parent = await prisma.customer.findFirst({
          where: { companyId: company.id, phone: phonePai }
        });

        if (!parent) {
          console.log(`  [SKIP CHILD/NO_PARENT] Filho '${nomeFilho}': Pai/Mãe com telefone '${rawPhonePai}' não encontrado no banco.`);
          childrenSkipped++;
          continue;
        }

        await prisma.customerChild.create({
          data: {
            customerId: parent.id,
            name: nomeFilho,
            birthDate: nascimentoFilho,
            notes: "Importação GO-LIVE-04"
          }
        });

        childrenMigrated++;
      }
    }
  } else {
    console.log("\n[!] No 'Filhos' sheet found. Skipping children import.");
  }

  console.log("\n==================================================");
  console.log("CRM IMPORT COMPLETE");
  console.log("==================================================");
  console.log(`Customers Migrated : ${clientsMigrated}`);
  console.log(`Customers Skipped  : ${clientsSkipped}`);
  console.log(`Children Migrated  : ${childrenMigrated}`);
  console.log(`Children Skipped   : ${childrenSkipped}`);
  console.log("==================================================");
}

importCrmData()
  .catch(err => {
    console.error("Critical error in importCrmData:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
