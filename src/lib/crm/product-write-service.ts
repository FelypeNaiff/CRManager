import { InventoryMovementType, Prisma, type ImportStockPolicy } from '@prisma/client';
import type { ServerAuthContext } from '@/lib/auth/server-auth-context';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { applyInventoryMovement, getOrCreateDefaultWarehouse } from '@/lib/inventory/inventory-service';

export type CanonicalProductWrite = {
  name: string;
  internalCode: string;
  sku: string;
  barcode?: string | null;
  costPrice?: Prisma.Decimal.Value;
  salePrice?: Prisma.Decimal.Value;
  unit?: string | null;
  ncm?: string | null;
  supplierName?: string | null;
  supplierId?: string | null; categoryId?: string | null; description?: string | null;
  purchaseUnit?: string; purchaseFactor?: Prisma.Decimal.Value; trackStock?: boolean; pdvEligible?: boolean;
  cest?: string | null; fiscalOrigin?: string | null; commissionRate?: Prisma.Decimal.Value | null;
  imageUrl?: string | null; thumbnailUrl?: string | null; galleryUrls?: string[]; barcodeType?: string | null;
  minimumStock?: Prisma.Decimal.Value;
};

async function resolveSupplier(tx: Prisma.TransactionClient, context: ServerAuthContext, name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) return null;
  const existing = await tx.supplier.findFirst({ where: { companyId: context.companyId, name: normalized, isActive: true } });
  if (existing) return existing;
  const supplier = await tx.supplier.create({ data: { companyId: context.companyId, name: normalized } });
  await writeActivityLog({ context, action: 'SUPPLIER_CREATE', module: 'SUPPLIERS', recordId: supplier.id,
    details: `Fornecedor "${supplier.name}" criado pela importação.` }, { policy: 'CRITICAL', tx });
  return supplier;
}

export async function createCanonicalProduct(tx: Prisma.TransactionClient, context: ServerAuthContext, input: CanonicalProductWrite) {
  const supplier = input.supplierId
    ? await tx.supplier.findFirst({ where: { id: input.supplierId, companyId: context.companyId, isActive: true } })
    : await resolveSupplier(tx, context, input.supplierName);
  if (input.supplierId && !supplier) throw new Error('Fornecedor não encontrado.');
  const product = await tx.product.create({ data: {
    companyId: context.companyId, supplierId: supplier?.id ?? null, categoryId: input.categoryId ?? null,
    name: input.name.trim(), internalCode: input.internalCode.trim(), description: input.description,
    salesUnit: input.unit?.trim() || 'UN', purchaseUnit: input.purchaseUnit?.trim() || input.unit?.trim() || 'UN',
    purchaseFactor: new Prisma.Decimal(input.purchaseFactor ?? 1), trackStock: input.trackStock ?? true, pdvEligible: input.pdvEligible ?? true,
    ncm: input.ncm?.trim() || null, cest: input.cest?.trim() || null, fiscalOrigin: input.fiscalOrigin?.trim() || null,
    commissionRate: input.commissionRate == null ? null : new Prisma.Decimal(input.commissionRate), imageUrl: input.imageUrl,
    thumbnailUrl: input.thumbnailUrl, galleryUrls: input.galleryUrls ?? [],
  } });
  if (supplier) await tx.productSupplier.create({ data: { companyId: context.companyId, productId: product.id, supplierId: supplier.id, isPrimary: true } });
  const variant = await tx.productVariant.create({ data: {
    companyId: context.companyId, productId: product.id, name: 'Único', sku: input.sku.trim(), barcode: input.barcode?.trim() || null,
    barcodeType: input.barcodeType ?? null, costPrice: new Prisma.Decimal(input.costPrice ?? 0), salePrice: new Prisma.Decimal(input.salePrice ?? 0),
    minimumStock: new Prisma.Decimal(input.minimumStock ?? 0),
  } });
  await tx.productPriceHistory.create({ data: { productId: product.id, oldCostPrice: new Prisma.Decimal(0),
    newCostPrice: variant.costPrice, oldSalePrice: new Prisma.Decimal(0), newSalePrice: variant.salePrice,
    changedByUserId: context.userId, changeReason: 'Preço inicial de cadastro' } });
  await writeActivityLog({ context, action: 'PRODUCT_CREATE', module: 'PRODUCTS', recordId: product.id,
    details: `Produto "${product.name}" criado.`, metadata: { name: product.name, internalCode: product.internalCode, supplierId: product.supplierId } }, { policy: 'CRITICAL', tx });
  await writeActivityLog({ context, action: 'PRODUCT_VARIANT_CREATE', module: 'PRODUCT_VARIANTS', recordId: variant.id,
    details: `Variação "${variant.name}" criada para o produto.`, metadata: { productId: product.id, sku: variant.sku } }, { policy: 'CRITICAL', tx });
  return { product, variant };
}

export async function updateCanonicalProduct(tx: Prisma.TransactionClient, context: ServerAuthContext, productId: string, variantId: string, input: CanonicalProductWrite) {
  const current = await tx.productVariant.findFirst({ where: { id: variantId, companyId: context.companyId, productId }, include: { product: true } });
  if (!current) throw new Error('Alvo da importação não existe mais.');
  const supplier = await resolveSupplier(tx, context, input.supplierName);
  const product = await tx.product.update({ where: { id: productId, companyId: context.companyId }, data: {
    name: input.name.trim(), internalCode: input.internalCode.trim(), ncm: input.ncm?.trim() || null,
    salesUnit: input.unit?.trim() || current.product.salesUnit, purchaseUnit: input.unit?.trim() || current.product.purchaseUnit,
    ...(supplier ? { supplierId: supplier.id } : {}),
  } });
  if (supplier) {
    await tx.productSupplier.updateMany({ where: { companyId: context.companyId, productId, isPrimary: true }, data: { isPrimary: false } });
    await tx.productSupplier.upsert({ where: { productId_supplierId: { productId, supplierId: supplier.id } }, update: { isPrimary: true },
      create: { companyId: context.companyId, productId, supplierId: supplier.id, isPrimary: true } });
  }
  const cost = input.costPrice === undefined ? current.costPrice : new Prisma.Decimal(input.costPrice);
  const sale = input.salePrice === undefined ? current.salePrice : new Prisma.Decimal(input.salePrice);
  const variant = await tx.productVariant.update({ where: { id: variantId, companyId: context.companyId }, data: {
    sku: input.sku.trim(), barcode: input.barcode?.trim() || null, costPrice: cost, salePrice: sale,
  } });
  if (!cost.equals(current.costPrice) || !sale.equals(current.salePrice)) await tx.productPriceHistory.create({ data: {
    productId, oldCostPrice: current.costPrice, newCostPrice: cost, oldSalePrice: current.salePrice, newSalePrice: sale,
    changedByUserId: context.userId, changeReason: 'Alteração via importação de produtos',
  } });
  await writeActivityLog({ context, action: 'PRODUCT_UPDATE', module: 'PRODUCTS', recordId: product.id,
    details: `Produto "${product.name}" atualizado pela importação.`, metadata: { variantId } }, { policy: 'CRITICAL', tx });
  return { product, variant };
}

export async function applyCanonicalImportStock(tx: Prisma.TransactionClient, context: ServerAuthContext, input: {
  importRowId: string; variantId: string; policy: ImportStockPolicy; quantity: Prisma.Decimal; previewStock: Prisma.Decimal | null;
}) {
  if (input.policy === 'NONE' || input.quantity.equals(0)) return;
  const variant = await tx.productVariant.findFirst({ where: { id: input.variantId, companyId: context.companyId } });
  if (!variant) throw new Error('Variante não encontrada para o estoque.');
  if (await tx.inventoryMovement.findUnique({ where: { importRowId: input.importRowId } })) return;
  const warehouse = await getOrCreateDefaultWarehouse(tx, context.companyId);
  let delta = input.quantity;
  let type: InventoryMovementType = 'PURCHASE';
  if (input.policy === 'INITIAL_IF_NO_HISTORY') {
    if (await tx.inventoryMovement.count({ where: { variantId: input.variantId } })) throw new Error('Saldo inicial recusado: a variante já possui histórico.');
    type = 'INITIAL';
  } else if (input.policy === 'TARGET_BALANCE') {
    if (input.previewStock === null || !variant.currentStock.equals(input.previewStock)) throw new Error('Conflito: estoque mudou desde a prévia.');
    delta = input.quantity.minus(variant.currentStock);
    type = 'MANUAL_ADJUSTMENT';
  }
  await applyInventoryMovement(tx, context, { warehouseId: warehouse.id, variantId: input.variantId, physicalDelta: delta,
    type, origin: 'PRODUCT_IMPORT', documentType: 'IMPORT_BATCH_ROW', documentId: input.importRowId,
    idempotencyKey: `import:${input.importRowId}`, importRowId: input.importRowId, reason: 'Importação de produtos',
    unitCost: variant.costPrice, allowNegativePhysical: false, allowNegativeAvailable: false });
}
