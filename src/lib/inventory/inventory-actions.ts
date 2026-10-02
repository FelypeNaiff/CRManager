'use server';

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';
import {
  approveInventorySession,
  createImmediateTransfer,
  createStockAdjustment,
  reverseStockAdjustment,
  reverseImmediateTransfer,
  startInventorySession,
} from './inventory-service';

export async function getInventoryOverview() {
  const context = await requirePermission('ESTOQUE', 'VIEW');
  const [warehouses, positions, sessions] = await Promise.all([
    prisma.warehouse.findMany({ where: { companyId: context.companyId }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.stockPosition.findMany({ where: { companyId: context.companyId }, include: { warehouse: true, variant: { include: { product: true } } }, orderBy: [{ warehouseId: 'asc' }, { variantId: 'asc' }], take: 200 }),
    prisma.inventorySession.findMany({ where: { companyId: context.companyId }, include: { warehouse: true, items: { include: { variant: { include: { product: true } } } }, _count: { select: { items: true } } }, orderBy: { startedAt: 'desc' }, take: 30 }),
  ]);
  return serializePrisma({ warehouses, positions, sessions });
}

export async function getInventoryLedger(input: { warehouseId?: string; variantId?: string; type?: string; origin?: string; document?: string; from?: Date; to?: Date; page?: number; pageSize?: number }) {
  const context = await requirePermission('ESTOQUE', 'VIEW');
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const where: Prisma.InventoryMovementWhereInput = {
    companyId: context.companyId,
    warehouseId: input.warehouseId || undefined,
    variantId: input.variantId || undefined,
    type: input.type as Prisma.EnumInventoryMovementTypeFilter | undefined,
    origin: input.origin || undefined,
    OR: input.document ? [{ documentId: { contains: input.document, mode: 'insensitive' } }, { documentType: { contains: input.document, mode: 'insensitive' } }] : undefined,
    occurredAt: input.from || input.to ? { gte: input.from, lte: input.to } : undefined,
  };
  const [total, rows] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({ where, include: { warehouse: true, variant: { include: { product: true } } }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const reconciled = await Promise.all(rows.map(async row => {
    const previous = await prisma.inventoryMovement.aggregate({ where: {
      companyId: context.companyId, warehouseId: row.warehouseId, variantId: row.variantId,
      OR: [{ occurredAt: { lt: row.occurredAt } }, { occurredAt: row.occurredAt, id: { lt: row.id } }],
    }, _sum: { quantity: true } });
    const balanceBefore = previous._sum.quantity ?? new Prisma.Decimal(0);
    return { ...row, balanceBefore, balanceAfter: balanceBefore.plus(row.quantity), entry: row.quantity.gt(0) ? row.quantity : new Prisma.Decimal(0), exit: row.quantity.lt(0) ? row.quantity.abs() : new Prisma.Decimal(0) };
  }));
  return serializePrisma({ rows: reconciled, total, page, pageSize });
}

export async function createWarehouseAction(input: { code: string; name: string }) {
  const context = await requirePermission('ESTOQUE', 'MANAGE_WAREHOUSES');
  return prisma.warehouse.create({ data: { companyId: context.companyId, code: input.code.trim().toUpperCase(), name: input.name.trim() } });
}

export async function deactivateWarehouseAction(id: string) {
  const context = await requirePermission('ESTOQUE', 'MANAGE_WAREHOUSES');
  return prisma.$transaction(async tx => {
    const warehouse = await tx.warehouse.findFirst({ where: { id, companyId: context.companyId } });
    if (!warehouse || warehouse.isDefault) throw new Error('Depósito inválido ou padrão.');
    const [balance, pending] = await Promise.all([
      tx.stockPosition.count({ where: { companyId: context.companyId, warehouseId: id, OR: [{ physicalStock: { not: 0 } }, { reservedStock: { not: 0 } }] } }),
      tx.inventorySession.count({ where: { companyId: context.companyId, warehouseId: id, status: 'COUNTING' } }),
    ]);
    if (balance || pending) throw new Error('Depósito possui saldo, reservas ou inventário pendente.');
    return tx.warehouse.update({ where: { id }, data: { isActive: false } });
  });
}

export async function createStockAdjustmentAction(input: { warehouseId: string; variantId: string; kind: 'DELTA' | 'TARGET'; quantity: string; expectedVersion?: number; reason: string; idempotencyKey?: string }) {
  const context = await requirePermission('ESTOQUE', 'ADJUST');
  return prisma.$transaction(tx => createStockAdjustment(tx, context, { ...input, idempotencyKey: input.idempotencyKey ?? randomUUID() }));
}

export async function reverseStockAdjustmentAction(input: { adjustmentId: string; reason: string; idempotencyKey?: string }) {
  const context = await requirePermission('ESTOQUE', 'ADJUST');
  return prisma.$transaction(tx => reverseStockAdjustment(tx, context, input.adjustmentId, input.idempotencyKey ?? randomUUID(), input.reason));
}

export async function createStockTransferAction(input: { fromWarehouseId: string; toWarehouseId: string; items: { variantId: string; quantity: string }[]; reason?: string; idempotencyKey?: string }) {
  const context = await requirePermission('ESTOQUE', 'TRANSFER');
  return prisma.$transaction(tx => createImmediateTransfer(tx, context, { ...input, idempotencyKey: input.idempotencyKey ?? randomUUID() }));
}

export async function reverseStockTransferAction(input: { transferId: string; reason: string; idempotencyKey?: string }) {
  const context = await requirePermission('ESTOQUE', 'TRANSFER');
  return prisma.$transaction(tx => reverseImmediateTransfer(tx, context, input.transferId, input.idempotencyKey ?? randomUUID(), input.reason));
}

export async function startInventoryAction(input: { warehouseId: string; name: string; variantIds: string[] }) {
  const context = await requirePermission('ESTOQUE', 'COUNT');
  return prisma.$transaction(tx => startInventorySession(tx, context, input));
}

export async function saveInventoryCountAction(input: { sessionId: string; itemId: string; quantity: string; recount?: boolean }) {
  const context = await requirePermission('ESTOQUE', 'COUNT');
  const session = await prisma.inventorySession.findFirst({ where: { id: input.sessionId, companyId: context.companyId, status: 'COUNTING' }, select: { id: true } });
  if (!session) throw new Error('Inventário não encontrado ou encerrado.');
  return prisma.inventoryCountItem.updateMany({ where: { id: input.itemId, sessionId: session.id }, data: input.recount ? { recountQuantity: input.quantity } : { countedQuantity: input.quantity } });
}

export async function approveInventoryAction(sessionId: string) {
  const context = await requirePermission('ESTOQUE', 'APPROVE_INVENTORY');
  return prisma.$transaction(tx => approveInventorySession(tx, context, sessionId));
}
