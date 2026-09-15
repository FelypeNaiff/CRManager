'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { getPaginationArgs, buildPaginatedResult, PaginationParams } from '@/lib/performance/pagination';
import { buildProductSearchWhere } from '@/lib/performance/query-utils';
import { writeActivityLog, writeLegacyActivityLog } from '../auth/activity-log';
import { addAuditChange, type AuditChanges } from '../auth/audit-changes';
import { sanitizeAuditDetails } from '../auth/audit-sanitization';
import {
  ProductCategorySchema,
  SupplierSchema,
  ProductSchema,
  InventoryMovementSchema,
} from './products-schemas';
import { InventoryMovementType, Prisma, AuthorizationType } from '@prisma/client';
import { authorizationService } from '../auth/authorization-service';
import { tenantWhere } from './tenant-security';
import { approvedAuthorizationWhere } from '../auth/authorization-security';
import { publicActionError } from '../auth/public-action-error';

async function validateProductRelations(
  companyId: string,
  categoryId?: string | null,
  supplierId?: string | null,
) {
  const [category, supplier] = await Promise.all([
    categoryId ? prisma.productCategory.findFirst({ where: tenantWhere(categoryId, companyId), select: { id: true } }) : null,
    supplierId ? prisma.supplier.findFirst({ where: tenantWhere(supplierId, companyId), select: { id: true } }) : null,
  ]);
  return (!categoryId || Boolean(category)) && (!supplierId || Boolean(supplier));
}


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
    return { success: true, data: serializePrisma(categories) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar categorias de produtos.') };
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

    await writeLegacyActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'PRODUTOS',
      recordId: newCategory.id,
      details: `Categoria "${newCategory.name}" criada.`,
    });

    return { success: true, data: serializePrisma(newCategory) };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe uma categoria com este nome.' };
    }
    return { success: false, error: publicActionError(error, 'Erro ao criar categoria de produto.') };
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
    return { success: true, data: serializePrisma(suppliers) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar fornecedores.') };
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

    await writeLegacyActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'PRODUTOS',
      recordId: newSupplier.id,
      details: `Fornecedor "${newSupplier.name}" criado.`,
    });

    return { success: true, data: serializePrisma(newSupplier) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao criar fornecedor.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao buscar produtos.') };
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
    return { success: true, data: serializePrisma(product) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar produto.') };
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
    if (!(await validateProductRelations(session.companyId, parsed.data.categoryId, parsed.data.supplierId))) {
      return { success: false, error: 'Categoria ou fornecedor não encontrado.' };
    }
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

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_CREATE',
        module: 'PRODUCTS',
        recordId: newProduct.id,
        details: `Produto "${newProduct.name}" criado.`,
        metadata: {
          name: newProduct.name,
          internalCode: newProduct.internalCode,
          categoryId: newProduct.categoryId,
        },
      }, { policy: 'CRITICAL', tx });

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_VARIANT_CREATE',
        module: 'PRODUCT_VARIANTS',
        recordId: defaultVariant.id,
        details: `Variação "${defaultVariant.name}" criada para o produto.`,
        metadata: {
          productId: newProduct.id,
          sku: defaultVariant.sku,
          name: defaultVariant.name,
        },
      }, { policy: 'CRITICAL', tx });

      return { product: newProduct, variant: defaultVariant };
    });

    

    return { success: true, data: serializePrisma(result.product) };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe um produto com este código interno ou SKU.' };
    }
    return { success: false, error: 'Erro ao criar produto.' };
  }
}

export async function updateProduct(id: string, input: any) {
  const session = await requirePermission('PRODUTOS', 'UPDATE');
  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    if (!(await validateProductRelations(session.companyId, parsed.data.categoryId, parsed.data.supplierId))) {
      return { success: false, error: 'Categoria ou fornecedor não encontrado.' };
    }
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
    const productChanges: AuditChanges = {};
    addAuditChange(productChanges, 'name', existing.name, parsed.data.name);
    addAuditChange(productChanges, 'internalCode', existing.internalCode, parsed.data.internalCode);
    addAuditChange(productChanges, 'description', existing.description, parsed.data.description);
    addAuditChange(productChanges, 'categoryId', existing.categoryId, parsed.data.categoryId || null);
    addAuditChange(productChanges, 'supplierId', existing.supplierId, parsed.data.supplierId || null);

    const variantChanges: AuditChanges = {};
    if (defaultVariant) {
      addAuditChange(variantChanges, 'sku', defaultVariant.sku, parsed.data.sku || defaultVariant.sku);
      addAuditChange(variantChanges, 'barcode', defaultVariant.barcode, parsed.data.barcode || defaultVariant.barcode);
      addAuditChange(variantChanges, 'barcodeType', defaultVariant.barcodeType, parsed.data.barcodeType || defaultVariant.barcodeType);
      addAuditChange(variantChanges, 'costPrice', Number(defaultVariant.costPrice), newCost);
      addAuditChange(variantChanges, 'salePrice', Number(defaultVariant.salePrice), newSale);
      addAuditChange(variantChanges, 'minimumStock', Number(defaultVariant.minimumStock), parsed.data.minimumStock ?? Number(defaultVariant.minimumStock));
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar produto
      const updated = await tx.product.update({
        where: tenantWhere(id, session.companyId),
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
          where: tenantWhere(defaultVariant.id, session.companyId),
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

      if (Object.keys(productChanges).length > 0) {
        await writeActivityLog({
          context: session,
          action: 'PRODUCT_UPDATE',
          module: 'PRODUCTS',
          recordId: id,
          details: `Produto "${updated.name}" atualizado.`,
          metadata: { changes: productChanges },
        }, { policy: 'CRITICAL', tx });
      }

      if (defaultVariant && Object.keys(variantChanges).length > 0) {
        await writeActivityLog({
          context: session,
          action: 'PRODUCT_VARIANT_UPDATE',
          module: 'PRODUCT_VARIANTS',
          recordId: defaultVariant.id,
          details: `Variação "${defaultVariant.name}" atualizada.`,
          metadata: { productId: id, changes: variantChanges },
        }, { policy: 'CRITICAL', tx });
      }

      return updated;
    });

    

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: 'Erro ao atualizar produto.' };
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

    await prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { productId: id, companyId: session.companyId, isActive: true },
        select: { id: true, name: true },
      });
      await tx.product.update({
        where: tenantWhere(id, session.companyId),
        data: { isActive: false, archivedAt: now },
      });
      await tx.productVariant.updateMany({
        where: { productId: id, companyId: session.companyId },
        data: { isActive: false, archivedAt: now },
      });
      await writeActivityLog({
        context: session,
        action: 'PRODUCT_STATUS_CHANGE',
        module: 'PRODUCTS',
        recordId: id,
        details: `Produto "${product.name}" inativado.`,
        metadata: { changes: { isActive: { before: true, after: false } } },
      }, { policy: 'CRITICAL', tx });
      for (const variant of variants) {
        await writeActivityLog({
          context: session,
          action: 'PRODUCT_VARIANT_STATUS_CHANGE',
          module: 'PRODUCT_VARIANTS',
          recordId: variant.id,
          details: `Variação "${variant.name}" inativada.`,
          metadata: { productId: id, changes: { isActive: { before: true, after: false } } },
        }, { policy: 'CRITICAL', tx });
      }
    });

    

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao remover produto.' };
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
    return { success: false, error: 'Erro ao consultar movimentações de estoque.' };
  }
}

export async function createInventoryMovement(input: any) {
  const session = await requirePermission('ESTOQUE', 'ADJUST');
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
          companyId: session.companyId,
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
            const auth = await tx.actionAuthorization.findFirst({
              where: approvedAuthorizationWhere({
                id: input.authorizationId,
                companyId: session.companyId,
                type: AuthorizationType.NEGATIVE_STOCK,
                module: 'ESTOQUE',
                referenceId: variantId,
                referenceModule: 'PRODUCT_VARIANT',
              }),
            });
            if (!auth) {
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
          const auth = await tx.actionAuthorization.findFirst({
            where: approvedAuthorizationWhere({
              id: input.authorizationId,
              companyId: session.companyId,
              type: AuthorizationType.STOCK_ADJUST,
              module: 'ESTOQUE',
              referenceId: variantId,
              referenceModule: 'PRODUCT_VARIANT',
            }),
          });
          if (!auth) {
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
        where: tenantWhere(variantId, session.companyId),
        data: {
          currentStock: new Prisma.Decimal(newCurrentStock),
          reservedStock: new Prisma.Decimal(newReservedStock),
          availableStock: new Prisma.Decimal(newAvailableStock),
        },
      });

      const manualAuditAction = type === 'MANUAL_ADJUSTMENT'
        ? 'STOCK_ADJUSTMENT'
        : type === 'INITIAL' || type === 'PURCHASE'
          ? 'STOCK_ENTRY'
          : type === 'LOSS' || type === 'DAMAGE'
            ? 'STOCK_EXIT'
            : null;

      if (manualAuditAction) {
        await writeActivityLog({
          context: session,
          action: manualAuditAction,
          module: 'INVENTORY',
          recordId: movement.id,
          details: `Movimentação manual de estoque registrada para "${variant.product.name}".`,
          metadata: {
            productId: variant.product.id,
            variantId,
            beforeQuantity: currentStock,
            afterQuantity: newCurrentStock,
            delta: quantity,
            reason: sanitizeAuditDetails(reason ?? undefined) ?? null,
            origin: type,
          },
        }, { policy: 'CRITICAL', tx });
      }

      return { successResult: { movement } };
    });

    if (result && 'requireAuthorization' in result) {
      return result;
    }

    const { movement } = result.successResult;

    return { success: true, data: serializePrisma(movement) };
  } catch (error: any) {
    return { success: false, error: 'Não foi possível concluir a movimentação de estoque.' };
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
    return { success: true, data: serializePrisma(history) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar histórico de preços.') };
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
    return { success: false, error: publicActionError(error, 'Erro ao consultar movimentações do produto.') };
  }
}
