import { InventoryMovementType, Prisma } from '@prisma/client';
import type { ServerAuthContext } from '@/lib/auth/server-auth-context';
import { writeActivityLog } from '@/lib/auth/activity-log';

export type InventoryTx = Prisma.TransactionClient;

export async function getOrCreateDefaultWarehouse(tx: InventoryTx, companyId: string) {
  return tx.warehouse.upsert({
    where: { companyId_code: { companyId, code: 'LOJA_PRINCIPAL' } },
    update: {}, create: { companyId, code: 'LOJA_PRINCIPAL', name: 'Loja principal', isDefault: true },
  });
}

export async function applyInventoryMovement(tx: InventoryTx, context: ServerAuthContext, input: {
  warehouseId: string; variantId: string; physicalDelta?: Prisma.Decimal.Value; reservedDelta?: Prisma.Decimal.Value;
  type: InventoryMovementType; origin: string; documentType?: string; documentId?: string; idempotencyKey: string;
  correlationId?: string; reason?: string | null; expectedVersion?: number; unit?: string; unitCost?: Prisma.Decimal.Value | null;
  allowNegativePhysical?: boolean; allowNegativeAvailable?: boolean; importRowId?: string; reversalOfId?: string;
}) {
  const existing = await tx.inventoryMovement.findUnique({ where: { companyId_idempotencyKey: { companyId: context.companyId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return existing;
  const [warehouse, variant] = await Promise.all([
    tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId: context.companyId, isActive: true } }),
    tx.productVariant.findFirst({ where: { id: input.variantId, companyId: context.companyId }, include: { product: { select: { salesUnit: true } } } }),
  ]);
  if (!warehouse) throw new Error('Depósito inválido ou inativo.');
  if (!variant) throw new Error('Variante não encontrada no tenant.');
  const position = await tx.stockPosition.upsert({ where: { companyId_warehouseId_variantId: { companyId: context.companyId, warehouseId: warehouse.id, variantId: variant.id } },
    update: {}, create: { companyId: context.companyId, warehouseId: warehouse.id, variantId: variant.id } });
  if (input.expectedVersion !== undefined && position.version !== input.expectedVersion) throw new Error('Conflito: a posição mudou desde a referência.');
  const physicalDelta = new Prisma.Decimal(input.physicalDelta ?? 0);
  const reservedDelta = new Prisma.Decimal(input.reservedDelta ?? 0);
  const physical = position.physicalStock.plus(physicalDelta);
  const reserved = position.reservedStock.plus(reservedDelta);
  const available = physical.minus(reserved);
  if (reserved.lt(0)) throw new Error('Reserva não pode ficar negativa.');
  if (physical.lt(0) && !input.allowNegativePhysical) throw new Error('Saldo físico insuficiente.');
  if (available.lt(0) && !input.allowNegativeAvailable) throw new Error('Saldo disponível insuficiente.');
  const updated = await tx.stockPosition.updateMany({ where: { id: position.id, version: position.version }, data: {
    physicalStock: physical, reservedStock: reserved, version: { increment: 1 },
  } });
  if (!updated.count) throw new Error('Conflito concorrente na posição de estoque.');
  const movement = await tx.inventoryMovement.create({ data: {
    companyId: context.companyId, warehouseId: warehouse.id, variantId: variant.id, quantity: physicalDelta,
    reservedQuantity: reservedDelta, type: input.type, origin: input.origin, documentType: input.documentType,
    documentId: input.documentId, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId,
    reversalOfId: input.reversalOfId, reason: input.reason, userId: context.userId, importRowId: input.importRowId,
    unit: input.unit ?? variant.product.salesUnit, unitCost: input.unitCost == null ? null : new Prisma.Decimal(input.unitCost),
  } });
  await tx.productVariant.update({ where: { id: variant.id, companyId: context.companyId }, data: {
    currentStock: { increment: physicalDelta }, reservedStock: { increment: reservedDelta }, availableStock: { increment: physicalDelta.minus(reservedDelta) },
  } });
  await writeActivityLog({ context, action: 'INVENTORY_MOVEMENT', module: 'INVENTORY', recordId: movement.id,
    details: input.reason ?? 'Movimento de estoque.', metadata: { warehouseId: warehouse.id, variantId: variant.id,
      physicalDelta: physicalDelta.toString(), reservedDelta: reservedDelta.toString(), origin: input.origin,
      documentType: input.documentType, documentId: input.documentId } }, { policy: 'CRITICAL', tx });
  return movement;
}

export async function createStockAdjustment(tx: InventoryTx, context: ServerAuthContext, input: {
  warehouseId: string; variantId: string; kind: 'DELTA'|'TARGET'; quantity: Prisma.Decimal.Value; expectedVersion?: number;
  reason: string; idempotencyKey: string; allowNegative?: boolean;
}) {
  if (!input.reason.trim()) throw new Error('Motivo é obrigatório.');
  const existing = await tx.stockAdjustment.findUnique({ where: { companyId_idempotencyKey: { companyId: context.companyId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return existing;
  const position = await tx.stockPosition.findUnique({ where: { companyId_warehouseId_variantId: { companyId: context.companyId, warehouseId: input.warehouseId, variantId: input.variantId } } });
  const current = position?.physicalStock ?? new Prisma.Decimal(0);
  if (input.kind === 'TARGET' && input.expectedVersion === undefined) throw new Error('Saldo-alvo exige versão de referência.');
  const requested = new Prisma.Decimal(input.quantity);
  const delta = input.kind === 'TARGET' ? requested.minus(current) : requested;
  const adjustment = await tx.stockAdjustment.create({ data: { companyId: context.companyId, warehouseId: input.warehouseId,
    variantId: input.variantId, kind: input.kind, requestedQuantity: requested, appliedDelta: delta,
    expectedVersion: input.expectedVersion, reason: input.reason.trim(), idempotencyKey: input.idempotencyKey, createdByUserId: context.userId } });
  await applyInventoryMovement(tx, context, { warehouseId: input.warehouseId, variantId: input.variantId, physicalDelta: delta,
    type: 'MANUAL_ADJUSTMENT', origin: 'ADJUSTMENT', documentType: 'STOCK_ADJUSTMENT', documentId: adjustment.id,
    idempotencyKey: `${input.idempotencyKey}:movement`, reason: input.reason, expectedVersion: input.expectedVersion,
    allowNegativePhysical: input.allowNegative, allowNegativeAvailable: input.allowNegative });
  return adjustment;
}

export async function reverseStockAdjustment(tx: InventoryTx, context: ServerAuthContext, adjustmentId: string, idempotencyKey: string, reason: string) {
  const original = await tx.stockAdjustment.findFirst({ where: { id: adjustmentId, companyId: context.companyId }, include: { reversedBy: true } });
  if (!original) throw new Error('Ajuste não encontrado.');
  if (original.reversedBy) return original.reversedBy;
  const position = await tx.stockPosition.findUniqueOrThrow({ where: { companyId_warehouseId_variantId: { companyId: context.companyId, warehouseId: original.warehouseId, variantId: original.variantId } } });
  const reversal = await tx.stockAdjustment.create({ data: { companyId: context.companyId, warehouseId: original.warehouseId, variantId: original.variantId,
    kind: 'DELTA', requestedQuantity: original.appliedDelta.negated(), appliedDelta: original.appliedDelta.negated(), expectedVersion: position.version,
    reason, status: 'REVERSAL', idempotencyKey, reversalOfId: original.id, createdByUserId: context.userId } });
  await applyInventoryMovement(tx, context, { warehouseId: original.warehouseId, variantId: original.variantId, physicalDelta: original.appliedDelta.negated(),
    type: 'MANUAL_ADJUSTMENT', origin: 'ADJUSTMENT_REVERSAL', documentType: 'STOCK_ADJUSTMENT', documentId: reversal.id,
    idempotencyKey: `${idempotencyKey}:movement`, reason, expectedVersion: position.version });
  return reversal;
}

export async function createImmediateTransfer(tx: InventoryTx, context: ServerAuthContext, input: {
  fromWarehouseId: string; toWarehouseId: string; items: { variantId: string; quantity: Prisma.Decimal.Value }[];
  idempotencyKey: string; reason?: string;
}) {
  if (input.fromWarehouseId === input.toWarehouseId) throw new Error('Origem e destino devem ser diferentes.');
  const existing = await tx.stockTransfer.findUnique({ where: { companyId_idempotencyKey: { companyId: context.companyId, idempotencyKey: input.idempotencyKey } }, include: { items: true } });
  if (existing) return existing;
  const warehouses = await tx.warehouse.count({ where: { companyId: context.companyId, id: { in: [input.fromWarehouseId, input.toWarehouseId] }, isActive: true } });
  if (warehouses !== 2) throw new Error('Depósitos inválidos ou inativos.');
  const transfer = await tx.stockTransfer.create({ data: { companyId: context.companyId, fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId, idempotencyKey: input.idempotencyKey, reason: input.reason, createdByUserId: context.userId,
    items: { create: input.items.map(item => ({ variantId: item.variantId, quantity: new Prisma.Decimal(item.quantity) })) } }, include: { items: true } });
  for (const item of transfer.items) {
    if (item.quantity.lte(0)) throw new Error('Quantidade de transferência deve ser positiva.');
    await applyInventoryMovement(tx, context, { warehouseId: transfer.fromWarehouseId, variantId: item.variantId, physicalDelta: item.quantity.negated(),
      type: 'TRANSFER', origin: 'TRANSFER_OUT', documentType: 'STOCK_TRANSFER', documentId: transfer.id,
      correlationId: transfer.id, idempotencyKey: `${input.idempotencyKey}:${item.variantId}:out`, reason: input.reason });
    await applyInventoryMovement(tx, context, { warehouseId: transfer.toWarehouseId, variantId: item.variantId, physicalDelta: item.quantity,
      type: 'TRANSFER', origin: 'TRANSFER_IN', documentType: 'STOCK_TRANSFER', documentId: transfer.id,
      correlationId: transfer.id, idempotencyKey: `${input.idempotencyKey}:${item.variantId}:in`, reason: input.reason });
  }
  return transfer;
}

export async function reverseImmediateTransfer(tx: InventoryTx, context: ServerAuthContext, transferId: string, idempotencyKey: string, reason: string) {
  const original = await tx.stockTransfer.findFirst({ where: { id: transferId, companyId: context.companyId }, include: { items: true, reversedBy: true } });
  if (!original) throw new Error('Transferência não encontrada.');
  if (original.reversedBy) return original.reversedBy;
  const reversal = await tx.stockTransfer.create({ data: {
    companyId: context.companyId, fromWarehouseId: original.toWarehouseId, toWarehouseId: original.fromWarehouseId,
    status: 'REVERSAL', reason, idempotencyKey, reversalOfId: original.id, createdByUserId: context.userId,
    items: { create: original.items.map(item => ({ variantId: item.variantId, quantity: item.quantity })) },
  }, include: { items: true } });
  for (const item of reversal.items) {
    await applyInventoryMovement(tx, context, { warehouseId: reversal.fromWarehouseId, variantId: item.variantId,
      physicalDelta: item.quantity.negated(), type: 'TRANSFER', origin: 'TRANSFER_REVERSAL_OUT', documentType: 'STOCK_TRANSFER',
      documentId: reversal.id, correlationId: original.id, idempotencyKey: `${idempotencyKey}:${item.variantId}:out`, reason });
    await applyInventoryMovement(tx, context, { warehouseId: reversal.toWarehouseId, variantId: item.variantId,
      physicalDelta: item.quantity, type: 'TRANSFER', origin: 'TRANSFER_REVERSAL_IN', documentType: 'STOCK_TRANSFER',
      documentId: reversal.id, correlationId: original.id, idempotencyKey: `${idempotencyKey}:${item.variantId}:in`, reason });
  }
  return reversal;
}

export async function startInventorySession(tx: InventoryTx, context: ServerAuthContext, input: { warehouseId: string; name: string; variantIds: string[] }) {
  const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId: context.companyId, isActive: true } });
  if (!warehouse) throw new Error('Depósito inválido.');
  const positions = await tx.stockPosition.findMany({ where: { companyId: context.companyId, warehouseId: warehouse.id, variantId: { in: input.variantIds } } });
  const map = new Map(positions.map(position => [position.variantId, position]));
  return tx.inventorySession.create({ data: { companyId: context.companyId, warehouseId: warehouse.id, name: input.name, createdByUserId: context.userId,
    items: { create: input.variantIds.map(variantId => ({ variantId, referencePhysical: map.get(variantId)?.physicalStock ?? new Prisma.Decimal(0), referenceVersion: map.get(variantId)?.version ?? 0 })) } }, include: { items: true } });
}

export async function approveInventorySession(tx: InventoryTx, context: ServerAuthContext, sessionId: string) {
  const session = await tx.inventorySession.findFirst({ where: { id: sessionId, companyId: context.companyId }, include: { items: true } });
  if (!session) throw new Error('Inventário não encontrado.');
  if (session.status === 'APPROVED') return session;
  if (session.status !== 'COUNTING') throw new Error('Inventário não pode ser aprovado.');
  for (const item of session.items) {
    if (item.appliedAt) continue;
    const counted = item.recountQuantity ?? item.countedQuantity;
    if (counted === null) throw new Error('Todos os itens precisam ser contados.');
    const position = await tx.stockPosition.findUnique({ where: { companyId_warehouseId_variantId: { companyId: context.companyId, warehouseId: session.warehouseId, variantId: item.variantId } } });
    if ((position?.version ?? 0) !== item.referenceVersion) throw new Error('Conflito: houve movimento durante a contagem; faça recontagem.');
    const movement = await applyInventoryMovement(tx, context, { warehouseId: session.warehouseId, variantId: item.variantId,
      physicalDelta: counted.minus(item.referencePhysical), type: 'MANUAL_ADJUSTMENT', origin: 'INVENTORY', documentType: 'INVENTORY_SESSION',
      documentId: session.id, idempotencyKey: `inventory:${session.id}:${item.id}`, reason: `Inventário ${session.name}`, expectedVersion: item.referenceVersion });
    await tx.inventoryCountItem.update({ where: { id: item.id }, data: { appliedAt: new Date(), appliedMovementId: movement.id } });
  }
  return tx.inventorySession.update({ where: { id: session.id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: context.userId } });
}
