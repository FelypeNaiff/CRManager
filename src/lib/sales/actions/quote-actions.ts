'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';
import { writeActivityLog } from '@/lib/auth/activity-log';

const quoteSchema = z.object({
  sellerId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  freightAmount: z.number().min(0).default(0),
  deliveryType: z.enum(['PICKUP', 'DELIVERY']).optional(),
  deliveryAddress: z.record(z.string(), z.string()).optional(),
  deliveryDate: z.string().datetime().optional(),
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().positive(), discount: z.number().min(0).default(0) })).min(1),
});

export async function createQuoteAction(raw: z.input<typeof quoteSchema>) {
  const auth = await requirePermission('VENDAS', 'CREATE');
  const input = quoteSchema.parse(raw);
  const quote = await prisma.$transaction(async tx => {
    const [seller, customer, variants] = await Promise.all([
      tx.seller.findFirst({ where: { id: input.sellerId, companyId: auth.companyId, status: 'ACTIVE' } }),
      input.customerId ? tx.customer.findFirst({ where: { id: input.customerId, companyId: auth.companyId } }) : null,
      tx.productVariant.findMany({ where: { id: { in: input.items.map(item => item.variantId) }, companyId: auth.companyId, isActive: true }, include: { product: true } }),
    ]);
    if (!seller) throw new Error('Vendedor inválido.');
    if (input.customerId && !customer) throw new Error('Cliente inválido.');
    if (variants.length !== new Set(input.items.map(item => item.variantId)).size) throw new Error('Produto inválido.');
    const byId = new Map(variants.map(variant => [variant.id, variant]));
    let subtotal = 0; let discountAmount = 0;
    const items = input.items.map(item => {
      const variant = byId.get(item.variantId)!; const unitPrice = Number(variant.salePrice);
      if (item.discount > unitPrice) throw new Error('Desconto inválido.');
      subtotal += unitPrice * item.quantity; discountAmount += item.discount * item.quantity;
      return { variantId: variant.id, productNameSnapshot: variant.product.name, variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku, barcodeSnapshot: variant.barcode, quantity: item.quantity, unitPrice,
        discount: item.discount, totalPrice: (unitPrice - item.discount) * item.quantity,
        costPriceAtSale: variant.costPrice, salePriceAtSale: variant.salePrice,
        marginAtSale: unitPrice ? ((unitPrice - Number(variant.costPrice)) / unitPrice) * 100 : 0 };
    });
    const created = await tx.sale.create({ data: { companyId: auth.companyId, sellerId: seller.id, customerId: customer?.id,
      channel: 'QUOTE', status: 'DRAFT', subtotal, discountAmount, totalAmount: subtotal - discountAmount + input.freightAmount,
      freightAmount: input.freightAmount, deliveryType: input.deliveryType, deliveryAddress: input.deliveryAddress,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined, notes: input.notes,
      customerNameSnapshot: customer?.name, customerPhoneSnapshot: customer?.phone, items: { create: items } }, include: { items: true } });
    await writeActivityLog({ context: auth, action: 'QUOTE_CREATE', module: 'SALES', recordId: created.id,
      details: 'Orçamento criado sem efeito de estoque.', metadata: { itemCount: created.items.length, total: Number(created.totalAmount) } }, { policy: 'CRITICAL', tx });
    return created;
  });
  return { success: true, quote: serializePrisma(quote) };
}

export async function listQuotesAction() {
  const auth = await requirePermission('VENDAS', 'VIEW');
  const quotes = await prisma.sale.findMany({ where: { companyId: auth.companyId, channel: 'QUOTE', status: 'DRAFT' },
    include: { customer: { select: { name: true } }, seller: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return serializePrisma(quotes);
}
