'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { tenantWhere } from './tenant-security';
import { serializePrisma } from '@/lib/serialize';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { z } from 'zod';

const factoryOrderSchema = z.object({
  supplierId: z.string().optional().nullable(),
  factoryName: z.string().min(1, "Nome da fábrica é obrigatório"),
  commercialDiscount: z.number().min(0).max(100).default(0),
  applySuframa: z.boolean().default(false),
  suframaDiscount: z.number().min(0).max(100).default(0),
  status: z.string().default("draft"),
  operatorName: z.string().min(1, "Operador é obrigatório"),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    partCode: z.string().min(1, "Código da peça é obrigatório"),
    reference: z.string().min(1, "Referência/Cor é obrigatório"),
    sizes: z.array(z.string()).min(1, "Ao menos um tamanho é obrigatório"),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    notes: z.string().optional().nullable(),
  })).min(1, "Adicione pelo menos um item ao pedido"),
});

export type FactoryOrderInput = z.infer<typeof factoryOrderSchema>;

export async function getFactoryOrders(search?: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');

  const where: any = { companyId: session.companyId };
  if (search) {
    where.OR = [
      { factoryName: { contains: search, mode: 'insensitive' } },
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { operatorName: { contains: search, mode: 'insensitive' } }
    ];
  }

  const orders = await prisma.factoryOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { items: true } }
    }
  });

  return { success: true, data: serializePrisma(orders) };
}

export async function getFactoryOrderById(id: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  const order = await prisma.factoryOrder.findFirst({
    where: tenantWhere(id, session.companyId),
    include: {
      items: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  if (!order) return { success: false, error: 'Pedido não encontrado.' };
  return { success: true, data: serializePrisma(order) };
}

export async function createFactoryOrder(rawInput: FactoryOrderInput) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  
  try {
    const input = factoryOrderSchema.parse(rawInput);
    
    // Calcula totais
    let totalPieces = 0;
    let totalGross = 0;
    let totalNet = 0;

    const orderItemsData = input.items.map((item, index) => {
      const pcs = item.quantity; // O form já manda a qtd total multiplicada se for o caso
      const priceRaw = item.unitPrice;
      const priceComm = priceRaw * (1 - input.commercialDiscount / 100);
      const priceSuframa = input.applySuframa ? priceComm * (1 - input.suframaDiscount / 100) : priceComm;
      const tPrice = priceSuframa * pcs;

      totalPieces += pcs;
      totalGross += priceRaw * pcs;
      totalNet += tPrice;

      return {
        companyId: session.companyId,
        partCode: item.partCode,
        reference: item.reference,
        sizes: item.sizes,
        quantity: item.quantity,
        unitPrice: priceRaw,
        priceWithCommercialDesc: priceComm,
        priceWithSuframa: priceSuframa,
        totalPrice: tPrice,
        notes: item.notes,
        orderIndex: index
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = `ped_${Date.now()}`;
      
      const order = await tx.factoryOrder.create({
        data: {
          companyId: session.companyId,
          orderNumber,
          supplierId: input.supplierId,
          factoryName: input.factoryName,
          commercialDiscount: input.commercialDiscount,
          applySuframa: input.applySuframa,
          suframaDiscount: input.suframaDiscount,
          status: input.status,
          operatorName: input.operatorName,
          notes: input.notes,
          totalPieces,
          totalGross,
          totalNet,
          items: {
            create: orderItemsData
          }
        }
      });

      await writeActivityLog({
        context: session,
        action: 'FACTORY_ORDER_CREATE',
        module: 'PRODUTOS',
        recordId: order.id,
        details: `Pedido de Fábrica criado: ${order.orderNumber} - ${order.factoryName}`
      }, { policy: 'BEST_EFFORT', tx });

      return order;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao criar pedido." };
  }
}

export async function updateFactoryOrder(id: string, rawInput: FactoryOrderInput) {
  const session = await requirePermission('PRODUTOS', 'UPDATE');
  
  try {
    const input = factoryOrderSchema.parse(rawInput);
    
    const existing = await prisma.factoryOrder.findFirst({ where: tenantWhere(id, session.companyId) });
    if (!existing) throw new Error("Pedido não encontrado.");

    let totalPieces = 0;
    let totalGross = 0;
    let totalNet = 0;

    const orderItemsData = input.items.map((item, index) => {
      const pcs = item.quantity;
      const priceRaw = item.unitPrice;
      const priceComm = priceRaw * (1 - input.commercialDiscount / 100);
      const priceSuframa = input.applySuframa ? priceComm * (1 - input.suframaDiscount / 100) : priceComm;
      const tPrice = priceSuframa * pcs;

      totalPieces += pcs;
      totalGross += priceRaw * pcs;
      totalNet += tPrice;

      return {
        companyId: session.companyId,
        partCode: item.partCode,
        reference: item.reference,
        sizes: item.sizes,
        quantity: item.quantity,
        unitPrice: priceRaw,
        priceWithCommercialDesc: priceComm,
        priceWithSuframa: priceSuframa,
        totalPrice: tPrice,
        notes: item.notes,
        orderIndex: index
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.factoryOrderItem.deleteMany({ where: { orderId: id } });
      
      const order = await tx.factoryOrder.update({
        where: { id },
        data: {
          supplierId: input.supplierId,
          factoryName: input.factoryName,
          commercialDiscount: input.commercialDiscount,
          applySuframa: input.applySuframa,
          suframaDiscount: input.suframaDiscount,
          status: input.status,
          operatorName: input.operatorName,
          notes: input.notes,
          totalPieces,
          totalGross,
          totalNet,
          items: {
            create: orderItemsData
          }
        }
      });

      await writeActivityLog({
        context: session,
        action: 'FACTORY_ORDER_UPDATE',
        module: 'PRODUTOS',
        recordId: order.id,
        details: `Pedido de Fábrica atualizado: ${order.orderNumber}`
      }, { policy: 'BEST_EFFORT', tx });

      return order;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao atualizar pedido." };
  }
}

export async function deleteFactoryOrder(id: string) {
  const session = await requirePermission('PRODUTOS', 'DELETE');
  
  try {
    const existing = await prisma.factoryOrder.findFirst({ where: tenantWhere(id, session.companyId) });
    if (!existing) throw new Error("Pedido não encontrado.");

    await prisma.$transaction(async (tx) => {
      await tx.factoryOrder.delete({ where: { id } });

      await writeActivityLog({
        context: session,
        action: 'FACTORY_ORDER_DELETE',
        module: 'PRODUTOS',
        recordId: id,
        details: `Pedido de Fábrica excluído: ${existing.orderNumber}`
      }, { policy: 'BEST_EFFORT', tx });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao excluir pedido." };
  }
}
