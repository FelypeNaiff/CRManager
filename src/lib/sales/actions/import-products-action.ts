'use server';

import { prisma } from '@/lib/prisma';
import { getActiveProfileSession } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';
import { Decimal } from '@prisma/client/runtime/library';

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
  try {
    const session = await getActiveProfileSession();
    if (!session?.userId || !session.companyId) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const companyId = session.companyId;
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
                changedByUserId: session.userId,
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
                userId: session.userId
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

          // Update other variant/product properties
          await tx.productVariant.update({
            where: { id: existingVariant.id },
            data: {
              costPrice,
              salePrice,
              name: item.tamanho || item.cor ? `${item.tamanho || ''} ${item.cor || ''}`.trim() : existingVariant.name,
              sku: sku || existingVariant.sku,
              barcode: barcode || existingVariant.barcode
            }
          });

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
          }

          // Write initial price history
          await tx.productPriceHistory.create({
            data: {
              productId: product.id,
              oldCostPrice: 0,
              newCostPrice: costPrice,
              oldSalePrice: 0,
              newSalePrice: salePrice,
              changedByUserId: session.userId,
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

          // Geração de estoque inicial
          if (!targetStock.isZero()) {
            await tx.inventoryMovement.create({
              data: {
                variantId: newVariant.id,
                quantity: targetStock,
                type: 'INITIAL',
                reason: 'GO-LIVE-04',
                userId: session.userId
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

    revalidatePath('/produtos');
    return { success: true, created: createdCount, updated: updatedCount };
  } catch (error: any) {
    console.error("Error during product import action:", error);
    return { success: false, error: error.message };
  }
}
