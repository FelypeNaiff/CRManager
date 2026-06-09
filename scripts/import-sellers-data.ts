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

async function importSellersData() {
  console.log("==================================================");
  console.log("NEEX SELLERS IMPORT RUNNER (GO-LIVE-04)");
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database.");
    process.exit(1);
  }

  const vendedoresPath = path.join(IMPORTS_DIR, 'vendedores.xlsx');
  if (!fs.existsSync(vendedoresPath)) {
    console.error(`  [FAIL] Sellers spreadsheet not found at: ${vendedoresPath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(vendedoresPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length <= 1) {
    console.error("  [FAIL] Vendedores sheet is empty.");
    process.exit(1);
  }

  const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "");
  const idx = {
    nome: headers.findIndex(h => h.toLowerCase().includes("nome")),
    comissao: headers.findIndex(h => h.toLowerCase().includes("comissão") || h.toLowerCase().includes("taxa") || h.toLowerCase().includes("porcentagem")),
    meta: headers.findIndex(h => h.toLowerCase().includes("meta")),
  };

  let migrated = 0;
  let skipped = 0;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

    const rowNum = i + 1;
    const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : "";
    const comissao = idx.comissao !== -1 ? parseNumber(row[idx.comissao]) : 0;
    const meta = idx.meta !== -1 ? parseNumber(row[idx.meta]) : 0;

    if (!nome) {
      console.log(`  [SKIP] Linha ${rowNum}: Nome do vendedor ausente.`);
      skipped++;
      continue;
    }

    // Check if seller already exists by name
    let seller = await prisma.seller.findFirst({
      where: { companyId: company.id, name: nome }
    });

    if (seller) {
      console.log(`  [UPDATE] Atualizando vendedor '${nome}' (Comissão: ${comissao}%, Meta: R$ ${meta})`);
      seller = await prisma.seller.update({
        where: { id: seller.id },
        data: {
          commissionRate: comissao,
          goal: meta
        }
      });
    } else {
      console.log(`  [CREATE] Criando vendedor '${nome}' (Comissão: ${comissao}%, Meta: R$ ${meta})`);
      seller = await prisma.seller.create({
        data: {
          companyId: company.id,
          name: nome,
          commissionRate: comissao,
          goal: meta,
          status: "ACTIVE"
        }
      });
    }

    // Set goal for current month
    if (meta > 0) {
      const existingGoal = await prisma.sellerGoal.findFirst({
        where: {
          sellerId: seller.id,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd }
        }
      });

      if (existingGoal) {
        await prisma.sellerGoal.update({
          where: { id: existingGoal.id },
          data: { targetAmount: meta }
        });
      } else {
        await prisma.sellerGoal.create({
          data: {
            sellerId: seller.id,
            periodStart,
            periodEnd,
            targetAmount: meta,
            achievedAmount: 0
          }
        });
      }
    }

    migrated++;
  }

  console.log("\n==================================================");
  console.log("SELLERS IMPORT COMPLETE");
  console.log("==================================================");
  console.log(`Sellers Processed : ${migrated}`);
  console.log(`Sellers Skipped   : ${skipped}`);
  console.log("==================================================");
}

importSellersData()
  .catch(err => {
    console.error("Critical error in importSellersData:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
