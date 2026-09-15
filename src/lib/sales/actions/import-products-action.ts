'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { Decimal } from '@prisma/client/runtime/library';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { addAuditChange, type AuditChanges } from '@/lib/auth/audit-changes';

interface ProductImportItem {
  codigo?: string;
  sku?: string;
  nome: string;
  compra: number;
  venda: number;
  barras?: string;
  estoque: number;
  grupo?: string;
  tamanho?: string;
  cor?: string;
  fornecedor?: string;
}

export async function importProductsAction(items: ProductImportItem[]) {
  const auth = await requirePermission('PRODUTOS', 'IMPORT');
  try {
    const companyId = auth.companyId;
    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const nome = item.nome.trim();
        const sku = item.sku?.trim() || "";
        const barcode = item.barras?.trim() || "";
        const internalCode = item.codigo?.trim() || "";
        const salePrice = new Decimal(item.venda);
        const costPrice = new Decimal(item.compra);
        const targetStock = new Decimal(item.estoque);

        // 1. Resolve Category
        let categoryId: string | null = null;
        if (item.grupo?.trim()) {
          const catName = item.grupo.trim();
          let category = await tx.productCategory.findFirst({
            where: { companyId, name: { equals: catName, mode: 'insensitive' } }
          });
          if (!category) {
            category = await tx.productCategory.create({
              data: { companyId, name: catName, isActive: true }
            });
          }
          categoryId = category.id;
        } else {
          // Default category Geral
          let category = await tx.productCategory.findFirst({
            where: { companyId, name: "Geral" }
          });
          if (!category) {
            category = await tx.productCategory.create({
              data: { companyId, name: "Geral", isActive: true }
            });
          }
          categoryId = category.id;
        }

        // 2. Resolve Supplier
        let supplierId: string | null = null;
        if (item.fornecedor?.trim()) {
          const supName = item.fornecedor.trim();
          let supplier = await tx.supplier.findFirst({
            where: { companyId, name: { equals: supName, mode: 'insensitive' } }
          });
          if (!supplier) {
            supplier = await tx.supplier.create({
              data: { companyId, name: supName, isActive: true }
            });
          }
          supplierId = supplier.id;
        }

        // 3. Lookup existing variant
        let existingVariant: any = null;

        // Step A: SKU
        if (sku) {
          existingVariant = await tx.productVariant.findFirst({
            where: { companyId, sku },
            include: { product: true }
          });
        }

        // Step B: Barcode (if not found by SKU)
        if (!existingVariant && barcode) {
          existingVariant = await tx.productVariant.findFirst({
            where: { companyId, barcode },
            include: { product: true }
          });
        }

        // Step C: Internal Code (if not found by SKU or Barcode)
        if (!existingVariant && internalCode) {
          existingVariant = await tx.productVariant.findFirst({
            where: { companyId, product: { internalCode } },
            include: { product: true }
          });
        }

        if (existingVariant) {
          const productChanges: AuditChanges = {};
          addAuditChange(productChanges, 'name', existingVariant.product.name, nome);
          addAuditChange(productChanges, 'categoryId', existingVariant.product.categoryId, categoryId);
          addAuditChange(productChanges, 'supplierId', existingVariant.product.supplierId, supplierId);
          addAuditChange(productChanges, 'internalCode', existingVariant.product.internalCode, internalCode || existingVariant.product.internalCode);
          const variantChanges: AuditChanges = {};
          addAuditChange(variantChanges, 'costPrice', Number(existingVariant.costPrice), Number(costPrice));
          addAuditChange(variantChanges, 'salePrice', Number(existingVariant.salePrice), Number(salePrice));
          addAuditChange(variantChanges, 'name', existingVariant.name, item.tamanho || item.cor ? `${item.tamanho || ''} ${item.cor || ''}`.trim() : existingVariant.name);
          addAuditChange(variantChanges, 'sku', existingVariant.sku, sku || existingVariant.sku);
          addAuditChange(variantChanges, 'barcode', existingVariant.barcode, barcode || existingVariant.barcode);

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
                changedByUserId: auth.userId,
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
            const movement = await tx.inventoryMovement.create({
              data: {
                variantId: existingVariant.id,
                quantity: delta,
                type: 'INITIAL',
                reason: 'GO-LIVE-04',
                userId: auth.userId
              }
            });

            // Apply stock adjustment
            await tx.productVariant.update({
              where: { id: existingVariant.id, companyId },
              data: {
                currentStock: currentStock.plus(delta),
                availableStock: currentAvailable.plus(delta)
              }
            });

            await writeActivityLog({
              context: auth,
              action: delta.greaterThan(0) ? 'STOCK_ENTRY' : 'STOCK_EXIT',
              module: 'INVENTORY',
              recordId: movement.id,
              details: 'Estoque inicial atualizado por importação de produtos.',
              metadata: {
                productId: existingVariant.productId,
                variantId: existingVariant.id,
                beforeQuantity: Number(currentStock),
                afterQuantity: Number(currentStock.plus(delta)),
                delta: Number(delta),
                reason: 'GO-LIVE-04',
                origin: 'PRODUCT_IMPORT',
              },
            }, { policy: 'CRITICAL', tx });
          }

          // Update other variant/product properties
          await tx.productVariant.update({
            where: { id: existingVariant.id, companyId },
            data: {
              costPrice,
              salePrice,
              name: item.tamanho || item.cor ? `${item.tamanho || ''} ${item.cor || ''}`.trim() : existingVariant.name,
              sku: sku || existingVariant.sku,
              barcode: barcode || existingVariant.barcode
            }
          });

          await tx.product.update({
            where: { id: existingVariant.productId, companyId },
            data: {
              name: nome,
              categoryId,
              supplierId,
              internalCode: internalCode || existingVariant.product.internalCode
            }
          });

          if (Object.keys(productChanges).length > 0) {
            await writeActivityLog({
              context: auth,
              action: 'PRODUCT_UPDATE',
              module: 'PRODUCTS',
              recordId: existingVariant.productId,
              details: `Produto "${nome}" atualizado por importação.`,
              metadata: { changes: productChanges, origin: 'PRODUCT_IMPORT' },
            }, { policy: 'CRITICAL', tx });
          }
          if (Object.keys(variantChanges).length > 0) {
            await writeActivityLog({
              context: auth,
              action: 'PRODUCT_VARIANT_UPDATE',
              module: 'PRODUCT_VARIANTS',
              recordId: existingVariant.id,
              details: 'Variação atualizada por importação de produtos.',
              metadata: { productId: existingVariant.productId, changes: variantChanges, origin: 'PRODUCT_IMPORT' },
            }, { policy: 'CRITICAL', tx });
          }

          updatedCount++;
        } else {
          // CREATE
          // Create product if not exists
          let product: any = null;
          let productWasCreated = false;
          if (internalCode) {
            product = await tx.product.findFirst({
              where: { companyId, internalCode }
            });
          }

          if (!product) {
            product = await tx.product.create({
              data: {
                companyId,
                name: nome,
                internalCode: internalCode || `PRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                categoryId,
                supplierId
              }
            });
            productWasCreated = true;
          }

          if (productWasCreated) {
            await writeActivityLog({
              context: auth,
              action: 'PRODUCT_CREATE',
              module: 'PRODUCTS',
              recordId: product.id,
              details: `Produto "${product.name}" criado por importação.`,
              metadata: {
                name: product.name,
                internalCode: product.internalCode,
                categoryId: product.categoryId,
                origin: 'PRODUCT_IMPORT',
              },
            }, { policy: 'CRITICAL', tx });
          }

          // Write initial price history
          await tx.productPriceHistory.create({
            data: {
              productId: product.id,
              oldCostPrice: 0,
              newCostPrice: costPrice,
              oldSalePrice: 0,
              newSalePrice: salePrice,
              changedByUserId: auth.userId,
              changeReason: "Carga Inicial - GO-LIVE-04"
            }
          });

          const variantName = item.tamanho || item.cor ? `${item.tamanho || ''} ${item.cor || ''}`.trim() : "Único";
          const newVariant = await tx.productVariant.create({
            data: {
              companyId,
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

          await writeActivityLog({
            context: auth,
            action: 'PRODUCT_VARIANT_CREATE',
            module: 'PRODUCT_VARIANTS',
            recordId: newVariant.id,
            details: `Variação "${newVariant.name}" criada por importação.`,
            metadata: { productId: product.id, sku: newVariant.sku, name: newVariant.name, origin: 'PRODUCT_IMPORT' },
          }, { policy: 'CRITICAL', tx });

          // Geração de estoque inicial
          if (!targetStock.isZero()) {
            const movement = await tx.inventoryMovement.create({
              data: {
                variantId: newVariant.id,
                quantity: targetStock,
                type: 'INITIAL',
                reason: 'GO-LIVE-04',
                userId: auth.userId
              }
            });

            await tx.productVariant.update({
              where: { id: newVariant.id, companyId },
              data: {
                currentStock: targetStock,
                availableStock: targetStock
              }
            });

            await writeActivityLog({
              context: auth,
              action: targetStock.greaterThan(0) ? 'STOCK_ENTRY' : 'STOCK_EXIT',
              module: 'INVENTORY',
              recordId: movement.id,
              details: 'Estoque inicial registrado por importação de produtos.',
              metadata: {
                productId: product.id,
                variantId: newVariant.id,
                beforeQuantity: 0,
                afterQuantity: Number(targetStock),
                delta: Number(targetStock),
                reason: 'GO-LIVE-04',
                origin: 'PRODUCT_IMPORT',
              },
            }, { policy: 'CRITICAL', tx });
          }

          createdCount++;
        }
      }
    });

    revalidatePath('/produtos');
    return { success: true, created: createdCount, updated: updatedCount };
  } catch {
    return { success: false, error: 'Erro ao importar produtos.' };
  }
}
