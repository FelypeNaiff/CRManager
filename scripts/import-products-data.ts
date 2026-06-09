import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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

async function importProductsData() {
  console.log("==================================================");
  console.log("NEEX PRODUCTS IMPORT RUNNER (GO-LIVE-04)");
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database. Run seeding first.");
    process.exit(1);
  }

  const activeUser = await prisma.user.findFirst({
    where: { companyId: company.id, status: "ACTIVE" }
  });
  if (!activeUser) {
    console.error("  [FAIL] No active user found for audits.");
    process.exit(1);
  }

  const produtosPath = path.join(IMPORTS_DIR, 'produtos.xlsx');
  if (!fs.existsSync(produtosPath)) {
    console.error(`  [FAIL] Products spreadsheet not found at: ${produtosPath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(produtosPath);
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("produto")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length <= 1) {
    console.error("  [FAIL] Produtos sheet is empty.");
    process.exit(1);
  }

  const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "");
  const idx = {
    codigo: headers.findIndex(h => h.toLowerCase().includes("código") && !h.toLowerCase().includes("barra")),
    estoque: headers.findIndex(h => h.toLowerCase().includes("estoque") || h.toLowerCase().includes("qtd")),
    nome: headers.findIndex(h => h.toLowerCase().includes("nome")),
    compra: headers.findIndex(h => h.toLowerCase().includes("compra") || h.toLowerCase().includes("custo")),
    venda: headers.findIndex(h => h.toLowerCase().includes("venda") || h.toLowerCase().includes("preço")),
    barras: headers.findIndex(h => h.toLowerCase().includes("barras") || h.toLowerCase().includes("gtin") || h.toLowerCase().includes("ean")),
    tamanho: headers.findIndex(h => h.toLowerCase().includes("tamanho")),
    cor: headers.findIndex(h => h.toLowerCase().includes("cor")),
    sku: headers.findIndex(h => h.toLowerCase().includes("sku")),
    fornecedor: headers.findIndex(h => h.toLowerCase().includes("fornecedor")),
    grupo: headers.findIndex(h => h.toLowerCase().includes("grupo") || h.toLowerCase().includes("categoria")),
  };

  let createdCount = 0;
  let updatedCount = 0;

  console.log("Importing products...");
  await prisma.$transaction(async (tx) => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every((c: any) => c === undefined || c === "")) continue;

      const rowNum = i + 1;
      const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : "";
      const sku = idx.sku !== -1 ? row[idx.sku]?.toString().trim() || "" : "";
      const barcode = idx.barras !== -1 ? row[idx.barras]?.toString().trim() || "" : "";
      const internalCode = idx.codigo !== -1 ? row[idx.codigo]?.toString().trim() || "" : "";
      const salePrice = new Decimal(idx.venda !== -1 ? parseNumber(row[idx.venda]) : 0);
      const costPrice = new Decimal(idx.compra !== -1 ? parseNumber(row[idx.compra]) : 0);
      const targetStock = new Decimal(idx.estoque !== -1 ? parseNumber(row[idx.estoque]) : 0);
      const grupo = idx.grupo !== -1 ? row[idx.grupo]?.toString().trim() : "";
      const fornecedor = idx.fornecedor !== -1 ? row[idx.fornecedor]?.toString().trim() : "";
      const tamanho = idx.tamanho !== -1 ? row[idx.tamanho]?.toString().trim() : "";
      const cor = idx.cor !== -1 ? row[idx.cor]?.toString().trim() : "";

      if (!nome) {
        console.log(`  [SKIP] Linha ${rowNum}: Nome ausente.`);
        continue;
      }

      // 1. Resolve Category
      let categoryId: string | null = null;
      if (grupo) {
        let category = await tx.productCategory.findFirst({
          where: { companyId: company.id, name: { equals: grupo, mode: 'insensitive' } }
        });
        if (!category) {
          category = await tx.productCategory.create({
            data: { companyId: company.id, name: grupo, isActive: true }
          });
        }
        categoryId = category.id;
      } else {
        let category = await tx.productCategory.findFirst({
          where: { companyId: company.id, name: "Geral" }
        });
        if (!category) {
          category = await tx.productCategory.create({
            data: { companyId: company.id, name: "Geral", isActive: true }
          });
        }
        categoryId = category.id;
      }

      // 2. Resolve Supplier
      let supplierId: string | null = null;
      if (fornecedor) {
        let supplier = await tx.supplier.findFirst({
          where: { companyId: company.id, name: { equals: fornecedor, mode: 'insensitive' } }
        });
        if (!supplier) {
          supplier = await tx.supplier.create({
            data: { companyId: company.id, name: fornecedor, isActive: true }
          });
        }
        supplierId = supplier.id;
      }

      // 3. Lookup existing variant
      let existingVariant: any = null;

      // Step A: SKU
      if (sku) {
        existingVariant = await tx.productVariant.findFirst({
          where: { companyId: company.id, sku },
          include: { product: true }
        });
      }

      // Step B: Barcode
      if (!existingVariant && barcode) {
        existingVariant = await tx.productVariant.findFirst({
          where: { companyId: company.id, barcode },
          include: { product: true }
        });
      }

      // Step C: Internal Code
      if (!existingVariant && internalCode) {
        existingVariant = await tx.productVariant.findFirst({
          where: { companyId: company.id, product: { internalCode } },
          include: { product: true }
        });
      }

      if (existingVariant) {
        // UPDATE
        // Write price history if cost or sale price changed
        if (!existingVariant.costPrice.equals(costPrice) || !existingVariant.salePrice.equals(salePrice)) {
          await tx.productPriceHistory.create({
            data: {
              productId: existingVariant.productId,
              oldCostPrice: existingVariant.costPrice,
              newCostPrice: costPrice,
              oldSalePrice: existingVariant.salePrice,
              newSalePrice: salePrice,
              changedByUserId: activeUser.id,
              changeReason: "Atualização de Preço/Custo - GO-LIVE-04"
            }
          });
        }

        // Calculate stock delta
        const currentAvailable = existingVariant.availableStock;
        const currentStock = existingVariant.currentStock;
        const delta = targetStock.minus(currentAvailable);

        if (!delta.isZero()) {
          // Register controlled initial adjustment
          await tx.inventoryMovement.create({
            data: {
              variantId: existingVariant.id,
              quantity: delta,
              type: 'INITIAL',
              reason: 'GO-LIVE-04',
              userId: activeUser.id
            }
          });

          // Apply stock adjustment
          await tx.productVariant.update({
            where: { id: existingVariant.id },
            data: {
              currentStock: currentStock.plus(delta),
              availableStock: currentAvailable.plus(delta)
            }
          });
        }

        // Update other variant properties
        const variantName = tamanho || cor ? `${tamanho || ''} ${cor || ''}`.trim() : existingVariant.name;
        await tx.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            costPrice,
            salePrice,
            name: variantName,
            sku: sku || existingVariant.sku,
            barcode: barcode || existingVariant.barcode
          }
        });

        // Update product
        await tx.product.update({
          where: { id: existingVariant.productId },
          data: {
            name: nome,
            categoryId,
            supplierId,
            internalCode: internalCode || existingVariant.product.internalCode
          }
        });

        updatedCount++;
      } else {
        // CREATE
        // Create product if not exists
        let product: any = null;
        if (internalCode) {
          product = await tx.product.findFirst({
            where: { companyId: company.id, internalCode }
          });
        }

        if (!product) {
          product = await tx.product.create({
            data: {
              companyId: company.id,
              name: nome,
              internalCode: internalCode || `PRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              categoryId,
              supplierId
            }
          });
        }

        // Write initial price history
        await tx.productPriceHistory.create({
          data: {
            productId: product.id,
            oldCostPrice: 0,
            newCostPrice: costPrice,
            oldSalePrice: 0,
            newSalePrice: salePrice,
            changedByUserId: activeUser.id,
            changeReason: "Carga Inicial - GO-LIVE-04"
          }
        });

        const variantName = tamanho || cor ? `${tamanho || ''} ${cor || ''}`.trim() : "Único";
        const newVariant = await tx.productVariant.create({
          data: {
            companyId: company.id,
            productId: product.id,
            name: variantName,
            sku: sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            barcode: barcode || null,
            costPrice,
            salePrice,
            currentStock: 0,
            availableStock: 0
          }
        });

        // Initial stock movement
        if (!targetStock.isZero()) {
          await tx.inventoryMovement.create({
            data: {
              variantId: newVariant.id,
              quantity: targetStock,
              type: 'INITIAL',
              reason: 'GO-LIVE-04',
              userId: activeUser.id
            }
          });

          await tx.productVariant.update({
            where: { id: newVariant.id },
            data: {
              currentStock: targetStock,
              availableStock: targetStock
            }
          });
        }

        createdCount++;
      }
    }
  });

  console.log("\n==================================================");
  console.log("PRODUCTS IMPORT COMPLETE");
  console.log("==================================================");
  console.log(`Products Created : ${createdCount}`);
  console.log(`Products Updated : ${updatedCount}`);
  console.log("==================================================");
}

importProductsData()
  .catch(err => {
    console.error("Critical error in importProductsData:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
