'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { getPaginationArgs, buildPaginatedResult, PaginationParams } from '@/lib/performance/pagination';
import { buildProductSearchWhere } from '@/lib/performance/query-utils';
import { writeActivityLog } from '../auth/activity-log';
import {
  ProductCategorySchema,
  SupplierSchema,
  ProductSchema,
  InventoryMovementSchema,
} from './products-schemas';
import { InventoryMovementType, Prisma, AuthorizationType } from '@prisma/client';
import { authorizationService } from '../auth/authorization-service';


// =========================================================================
// ProductCategory Actions
// =========================================================================

export async function getProductCategories() {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const categories = await prisma.productCategory.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: categories };
  } catch (error: any) {
    console.error('Error fetching product categories:', error);
    return { success: false, error: error.message };
  }
}

export async function createProductCategory(input: any) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  const parsed = ProductCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const newCategory = await prisma.productCategory.create({
      data: {
        companyId: session.companyId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'PRODUTOS',
      recordId: newCategory.id,
      details: `Categoria "${newCategory.name}" criada.`,
    });

    return { success: true, data: newCategory };
  } catch (error: any) {
    console.error('Error creating product category:', error);
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe uma categoria com este nome.' };
    }
    return { success: false, error: error.message };
  }
}

// =========================================================================
// Supplier Actions
// =========================================================================

export async function getSuppliers() {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: suppliers };
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return { success: false, error: error.message };
  }
}

export async function createSupplier(input: any) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  const parsed = SupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const newSupplier = await prisma.supplier.create({
      data: {
        companyId: session.companyId,
        name: parsed.data.name,
        cnpjCpf: parsed.data.cnpjCpf,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'PRODUTOS',
      recordId: newSupplier.id,
      details: `Fornecedor "${newSupplier.name}" criado.`,
    });

    return { success: true, data: newSupplier };
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return { success: false, error: error.message };
  }
}

// =========================================================================
// Product Actions
// =========================================================================

export async function getProducts(filters?: { categoryId?: string; search?: string } & PaginationParams) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const { skip, take, page, pageSize } = getPaginationArgs(filters);
    
    let whereClause: Prisma.ProductWhereInput = {
      companyId: session.companyId,
      isActive: true,
    };

    if (filters?.categoryId) {
      whereClause.categoryId = filters.categoryId;
    }

    if (filters?.search) {
      const searchWhere = buildProductSearchWhere(filters.search);
      if (searchWhere.OR) {
        whereClause.OR = searchWhere.OR;
      }
    }

    const [totalCount, products] = await Promise.all([
      prisma.product.count({ where: whereClause }),
      prisma.product.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          internalCode: true,
          imageUrl: true,
          categoryId: true,
          category: { select: { name: true } },
          supplierId: true,
          supplier: { select: { name: true } },
          variants: {
            where: { isActive: true, companyId: session.companyId },
            select: {
              id: true,
              sku: true,
              barcode: true,
              name: true,
              costPrice: true,
              salePrice: true,
              currentStock: true,
              availableStock: true,
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      })
    ]);

    return { success: true, ...buildPaginatedResult(products, totalCount, page, pageSize) };
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return { success: false, error: error.message };
  }
}

export async function getProductById(id: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const product = await prisma.product.findFirst({
      where: { id, companyId: session.companyId, isActive: true },
      include: {
        category: true,
        supplier: true,
        variants: {
          where: { isActive: true, companyId: session.companyId },
        },
      },
    });
    if (!product) {
      return { success: false, error: 'Produto não encontrado.' };
    }
    return { success: true, data: product };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createProduct(input: any) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const cost = parsed.data.costPrice ?? 0;
  const sale = parsed.data.salePrice ?? 0;
  const skuVal = parsed.data.sku || `SKU-${parsed.data.internalCode}`;
  const minStock = parsed.data.minimumStock ?? 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar o produto principal
      const newProduct = await tx.product.create({
        data: {
          companyId: session.companyId,
          categoryId: parsed.data.categoryId || null,
          supplierId: parsed.data.supplierId || null,
          name: parsed.data.name,
          internalCode: parsed.data.internalCode,
          description: parsed.data.description,
          imageUrl: parsed.data.imageUrl,
          thumbnailUrl: parsed.data.thumbnailUrl,
          galleryUrls: parsed.data.galleryUrls,
        },
      });

      // 2. Criar a variação única padrão
      const defaultVariant = await tx.productVariant.create({
        data: {
          companyId: session.companyId,
          productId: newProduct.id,
          name: 'Único',
          sku: skuVal,
          barcode: parsed.data.barcode || null,
          barcodeType: parsed.data.barcodeType || null,
          costPrice: new Prisma.Decimal(cost),
          salePrice: new Prisma.Decimal(sale),
          minimumStock: new Prisma.Decimal(minStock),
          currentStock: new Prisma.Decimal(0),
          reservedStock: new Prisma.Decimal(0),
          availableStock: new Prisma.Decimal(0),
        },
      });

      // 3. Registrar o preço inicial no histórico de preços
      await tx.productPriceHistory.create({
        data: {
          productId: newProduct.id,
          oldCostPrice: new Prisma.Decimal(0),
          newCostPrice: new Prisma.Decimal(cost),
          oldSalePrice: new Prisma.Decimal(0),
          newSalePrice: new Prisma.Decimal(sale),
          changedByUserId: session.userId,
          changeReason: 'Preço inicial de cadastro',
        },
      });

      return { product: newProduct, variant: defaultVariant };
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'PRODUTOS',
      recordId: result.product.id,
      details: `Produto "${result.product.name}" criado com código interno ${result.product.internalCode} e SKU ${result.variant.sku}.`,
    });

    

    return { success: true, data: result.product };
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe um produto com este código interno ou SKU.' };
    }
    return { success: false, error: error.message };
  }
}

export async function updateProduct(id: string, input: any) {
  const session = await requirePermission('PRODUTOS', 'UPDATE');
  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.product.findFirst({
      where: { id, companyId: session.companyId, isActive: true },
      include: {
        variants: {
          where: { name: 'Único', isActive: true, companyId: session.companyId },
        },
      },
    });

    if (!existing) {
      return { success: false, error: 'Produto não encontrado.' };
    }

    const defaultVariant = existing.variants[0];
    const oldCost = defaultVariant ? Number(defaultVariant.costPrice) : 0;
    const oldSale = defaultVariant ? Number(defaultVariant.salePrice) : 0;
    const newCost = parsed.data.costPrice ?? oldCost;
    const newSale = parsed.data.salePrice ?? oldSale;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar produto
      const updated = await tx.product.update({
        where: { id },
        data: {
          categoryId: parsed.data.categoryId || null,
          supplierId: parsed.data.supplierId || null,
          name: parsed.data.name,
          internalCode: parsed.data.internalCode,
          description: parsed.data.description,
          imageUrl: parsed.data.imageUrl,
          thumbnailUrl: parsed.data.thumbnailUrl,
          galleryUrls: parsed.data.galleryUrls,
        },
      });

      // 2. Atualizar variante padrão (Único) se existir
      if (defaultVariant) {
        await tx.productVariant.update({
          where: { id: defaultVariant.id },
          data: {
            sku: parsed.data.sku || defaultVariant.sku,
            barcode: parsed.data.barcode || defaultVariant.barcode,
            barcodeType: parsed.data.barcodeType || defaultVariant.barcodeType,
            costPrice: new Prisma.Decimal(newCost),
            salePrice: new Prisma.Decimal(newSale),
            minimumStock: parsed.data.minimumStock !== undefined ? new Prisma.Decimal(parsed.data.minimumStock) : defaultVariant.minimumStock,
          },
        });
      }

      // 3. Se preços mudaram, registrar no histórico de preços
      if (newCost !== oldCost || newSale !== oldSale) {
        await tx.productPriceHistory.create({
          data: {
            productId: id,
            oldCostPrice: new Prisma.Decimal(oldCost),
            newCostPrice: new Prisma.Decimal(newCost),
            oldSalePrice: new Prisma.Decimal(oldSale),
            newSalePrice: new Prisma.Decimal(newSale),
            changedByUserId: session.userId,
            changeReason: 'Alteração de preços via edição de produto',
          },
        });
      }

      return updated;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'EDITAR',
      module: 'PRODUTOS',
      recordId: id,
      details: `Produto "${result.name}" atualizado. Alterações salvas no banco.`,
    });

    

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteProduct(id: string) {
  const session = await requirePermission('PRODUTOS', 'DELETE');
  try {
    const product = await prisma.product.findFirst({
      where: { id, companyId: session.companyId, isActive: true },
    });

    if (!product) {
      return { success: false, error: 'Produto não encontrado.' };
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { isActive: false, archivedAt: now },
      }),
      prisma.productVariant.updateMany({
        where: { productId: id },
        data: { isActive: false, archivedAt: now },
      }),
    ]);

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETAR',
      module: 'PRODUTOS',
      recordId: id,
      details: `Produto "${product.name}" inativado/arquivado (Soft Delete).`,
    });

    

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }
}

// =========================================================================
// Inventory & Movements Actions
// =========================================================================

export async function getInventoryMovements(filters?: { variantId?: string } & PaginationParams) {
  const session = await requirePermission('ESTOQUE', 'VIEW');
  try {
    const { skip, take, page, pageSize } = getPaginationArgs(filters);
    const variantId = filters?.variantId;
    
    let whereClause: Prisma.InventoryMovementWhereInput = {
      ...(variantId ? { variantId } : {}),
      variant: {
        companyId: session.companyId,
        product: { companyId: session.companyId },
      },
    };

    const [totalCount, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where: whereClause }),
      prisma.inventoryMovement.findMany({
        where: whereClause,
        include: {
          variant: {
            include: {
              product: true
            }
          },
          user: true
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      })
    ]);
    return { success: true, ...buildPaginatedResult(movements, totalCount, page, pageSize) };
  } catch (error: any) {
    console.error('Error fetching inventory movements:', error);
    return { success: false, error: error.message };
  }
}

export async function createInventoryMovement(input: any) {
  const session = await requirePermission('ESTOQUE', 'CREATE');
  const parsed = InventoryMovementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { variantId, quantity, type, reason, warehouseId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Obter a variante e o produto para verificar tenant ownership
      const variant = await tx.productVariant.findFirst({
        where: {
          id: variantId,
          product: { companyId: session.companyId },
        },
        include: { product: true },
      });

      if (!variant) {
        throw new Error('Variante não encontrada ou não pertence a esta empresa.');
      }

      // 2. Buscar as configurações de estoque da empresa
      const company = await tx.company.findUnique({
        where: { id: session.companyId },
      });

      if (!company) {
        throw new Error('Empresa não encontrada.');
      }

      // 3. Calcular novos saldos com base no tipo de movimentação
      const currentStock = Number(variant.currentStock);
      const reservedStock = Number(variant.reservedStock);

      let newCurrentStock = currentStock;
      let newReservedStock = reservedStock;

      if (type === 'RESERVATION') {
        newReservedStock += quantity;
      } else {
        newCurrentStock += quantity;
      }

      const newAvailableStock = newCurrentStock - newReservedStock;

      // 4. Aplicar regras de bloqueio de estoque negativo e autorização
      const isPDV = type === 'SALE' || type === 'EXCHANGE';
      const isManual = type === 'MANUAL_ADJUSTMENT' || type === 'DAMAGE' || type === 'LOSS';

      if (newAvailableStock < 0) {
        if (isPDV && !company.allowNegativeStockOnPDV) {
          throw new Error('Estoque insuficiente para esta venda (Operação PDV bloqueada).');
        }

        if (isManual && !company.allowNegativeStockOnManualAdjustment) {
          if (input.authorizationId) {
            const auth = await tx.actionAuthorization.findUnique({ where: { id: input.authorizationId } });
            if (!auth || auth.status !== 'APPROVED') {
              throw new Error('Autorização de estoque negativo inválida ou não aprovada.');
            }
          } else {
            const authReq = await authorizationService.createAuthorizationRequest({
              companyId: session.companyId,
              type: AuthorizationType.NEGATIVE_STOCK,
              module: 'ESTOQUE',
              requestedByUserId: session.userId,
              referenceId: variantId,
              referenceModule: 'PRODUCT_VARIANT',
              amount: quantity,
              reason: reason || 'Estoque Negativo',
              financialImpact: false,
            });
            return { requireAuthorization: true, authorizationId: authReq.id };
          }
        }
      }

      if (isManual && newAvailableStock >= 0) {
        // Correção manual de quantidade normal
        if (input.authorizationId) {
          const auth = await tx.actionAuthorization.findUnique({ where: { id: input.authorizationId } });
          if (!auth || auth.status !== 'APPROVED') {
            throw new Error('Autorização de ajuste de estoque inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: session.companyId,
            type: AuthorizationType.STOCK_ADJUST,
            module: 'ESTOQUE',
            requestedByUserId: session.userId,
            referenceId: variantId,
            referenceModule: 'PRODUCT_VARIANT',
            amount: quantity,
            reason: reason || 'Ajuste de Estoque Manual',
            financialImpact: false,
          });
          return { requireAuthorization: true, authorizationId: authReq.id };
        }
      }

      // 5. Registrar a movimentação
      const movement = await tx.inventoryMovement.create({
        data: {
          variantId,
          quantity: new Prisma.Decimal(quantity),
          type: type as InventoryMovementType,
          reason,
          warehouseId,
          userId: session.userId,
        },
      });

      // 6. Atualizar os saldos consolidados na variante
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          currentStock: new Prisma.Decimal(newCurrentStock),
          reservedStock: new Prisma.Decimal(newReservedStock),
          availableStock: new Prisma.Decimal(newAvailableStock),
        },
      });

      return { successResult: { movement, product: variant.product, newAvailableStock } };
    });

    if (result && 'requireAuthorization' in result) {
      return result;
    }

    const { movement, product, newAvailableStock } = result.successResult;

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'ESTOQUE',
      recordId: movement.id,
      details: `Movimentação de estoque (${type}) de ${quantity} unidades criada para o produto "${product.name}". Novo saldo disponível: ${newAvailableStock}.`,
    });

    const movementWithVariant = await prisma.inventoryMovement.findUnique({
      where: { id: movement.id },
      include: { variant: true }
    });
    if (movementWithVariant?.variant) {
      
    }

    return { success: true, data: movement };
  } catch (error: any) {
    console.error('Error creating inventory movement:', error);
    return { success: false, error: error.message };
  }
}

export async function getProductPriceHistory(productId: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const history = await prisma.productPriceHistory.findMany({
      where: {
        productId,
        product: { companyId: session.companyId }
      },
      orderBy: { changedAt: 'desc' }
    });
    return { success: true, data: history };
  } catch (error: any) {
    console.error('Error fetching product price history:', error);
    return { success: false, error: error.message };
  }
}


export async function getProductInventoryMovements(productId: string, filters?: PaginationParams) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const { skip, take, page, pageSize } = getPaginationArgs(filters);
    
    let whereClause: Prisma.InventoryMovementWhereInput = {
      variant: {
        productId,
        companyId: session.companyId,
      }
    };

    const [totalCount, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where: whereClause }),
      prisma.inventoryMovement.findMany({
        where: whereClause,
      include: {
        variant: true,
        user: true
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })
    ]);
    return { success: true, ...buildPaginatedResult(movements, totalCount, page, pageSize) };
  } catch (error: any) {
    console.error('Error fetching product inventory movements:', error);
    return { success: false, error: error.message };
  }
}
