'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission } from '@/lib/auth/permissions';
import { serializePrisma } from '@/lib/serialize';
import { writeActivityLog } from '@/lib/auth/activity-log';

const draftSchema = z.object({
  draftId: z.string().uuid().optional(),
  sellerId: z.string().min(1),
  customerId: z.string().optional(),
  globalDiscountType: z.enum(['PERCENTAGE', 'AMOUNT']),
  globalDiscountValue: z.number().min(0),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().positive(),
    discountType: z.enum(['PERCENTAGE', 'AMOUNT']),
    discountValue: z.number().min(0),
  })).min(1),
  payments: z.array(z.object({
    paymentMethodId: z.string().min(1),
    amount: z.number().positive(),
    installments: z.number().int().positive(),
  })),
});

async function requireDraftWrite() {
  return requireAnyPermission([
    { module: 'PDV', action: 'CREATE' },
    { module: 'PDV', action: 'CREATE_SALE' },
  ]);
}

export async function saveDraftSaleAction(rawInput: z.input<typeof draftSchema>) {
  try {
    const auth = await requireDraftWrite();
    const input = draftSchema.parse(rawInput);

    const draft = await prisma.$transaction(async tx => {
      const [seller, customer, variants, paymentMethods] = await Promise.all([
        tx.seller.findFirst({ where: { id: input.sellerId, companyId: auth.companyId, status: 'ACTIVE' }, select: { id: true } }),
        input.customerId
          ? tx.customer.findFirst({ where: { id: input.customerId, companyId: auth.companyId }, select: { id: true, name: true, phone: true } })
          : Promise.resolve(null),
        tx.productVariant.findMany({
          where: { id: { in: input.items.map(item => item.variantId) }, companyId: auth.companyId, isActive: true },
          include: { product: { select: { name: true } } },
        }),
        tx.paymentMethod.findMany({
          where: { id: { in: input.payments.map(payment => payment.paymentMethodId) }, companyId: auth.companyId, isActive: true },
          select: { id: true },
        }),
      ]);

      if (!seller) throw new Error('INVALID_SELLER');
      if (input.customerId && !customer) throw new Error('INVALID_CUSTOMER');
      if (variants.length !== new Set(input.items.map(item => item.variantId)).size) throw new Error('INVALID_VARIANT');
      if (paymentMethods.length !== new Set(input.payments.map(payment => payment.paymentMethodId)).size) throw new Error('INVALID_PAYMENT');

      const variantMap = new Map(variants.map(variant => [variant.id, variant]));
      let subtotal = 0;
      let itemDiscounts = 0;
      const items = input.items.map(item => {
        const variant = variantMap.get(item.variantId)!;
        const unitPrice = Number(variant.salePrice);
        const costPrice = Number(variant.costPrice);
        const unitDiscount = item.discountType === 'PERCENTAGE'
          ? unitPrice * item.discountValue / 100
          : item.discountValue;
        if (item.discountType === 'PERCENTAGE' && item.discountValue > 100) throw new Error('INVALID_DISCOUNT');
        if (unitDiscount > unitPrice) throw new Error('INVALID_DISCOUNT');
        subtotal += unitPrice * item.quantity;
        itemDiscounts += unitDiscount * item.quantity;
        return {
          variantId: variant.id,
          productNameSnapshot: variant.product.name,
          variantNameSnapshot: variant.name,
          skuSnapshot: variant.sku,
          barcodeSnapshot: variant.barcode,
          quantity: item.quantity,
          unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          discount: unitDiscount,
          totalPrice: (unitPrice - unitDiscount) * item.quantity,
          costPriceAtSale: costPrice,
          salePriceAtSale: unitPrice,
          marginAtSale: unitPrice === 0 ? 0 : ((unitPrice - costPrice) / unitPrice) * 100,
        };
      });
      const afterItems = subtotal - itemDiscounts;
      const globalDiscount = input.globalDiscountType === 'PERCENTAGE'
        ? afterItems * input.globalDiscountValue / 100
        : input.globalDiscountValue;
      if (globalDiscount > afterItems || (input.globalDiscountType === 'PERCENTAGE' && input.globalDiscountValue > 100)) {
        throw new Error('INVALID_DISCOUNT');
      }

      const data = {
        sellerId: input.sellerId,
        customerId: input.customerId || null,
        status: 'DRAFT' as const,
        subtotal,
        discountAmount: itemDiscounts + globalDiscount,
        globalDiscountType: input.globalDiscountType,
        globalDiscountValue: input.globalDiscountValue,
        totalAmount: afterItems - globalDiscount,
        customerNameSnapshot: customer?.name,
        customerPhoneSnapshot: customer?.phone,
        items: { create: items },
        payments: { create: input.payments.map(payment => ({ ...payment, status: 'DRAFT' })) },
      };

      if (input.draftId) {
        const existing = await tx.sale.findFirst({ where: { id: input.draftId, companyId: auth.companyId, status: 'DRAFT' }, select: { id: true } });
        if (!existing) throw new Error('DRAFT_NOT_FOUND');
        await tx.saleItem.deleteMany({ where: { saleId: existing.id } });
        await tx.salePayment.deleteMany({ where: { saleId: existing.id } });
        const updated = await tx.sale.update({ where: { id: existing.id }, data, include: { items: true, payments: true } });
        await writeActivityLog({
          context: auth,
          action: 'SALE_DRAFT_SAVE',
          module: 'SALES',
          recordId: updated.id,
          details: 'Venda guardada atualizada no PDV.',
          metadata: { itemCount: updated.items.length },
        }, { policy: 'CRITICAL', tx });
        return updated;
      }

      const created = await tx.sale.create({ data: { ...data, companyId: auth.companyId }, include: { items: true, payments: true } });
      await writeActivityLog({
        context: auth,
        action: 'SALE_DRAFT_SAVE',
        module: 'SALES',
        recordId: created.id,
        details: 'Venda guardada no PDV.',
        metadata: { itemCount: created.items.length },
      }, { policy: 'CRITICAL', tx });
      return created;
    });

    return { success: true, draft: serializePrisma(draft) };
  } catch {
    return { success: false, error: 'Não foi possível guardar a venda.' };
  }
}

export async function getDraftSaleAction(draftId: string) {
  try {
    const auth = await requireAnyPermission([
      { module: 'PDV', action: 'VIEW' },
      { module: 'VENDAS', action: 'VIEW' },
    ]);
    const draft = await prisma.sale.findFirst({
      where: { id: draftId, companyId: auth.companyId, status: 'DRAFT' },
      include: {
        customer: { include: { wallet: true } },
        items: { include: { variant: { select: { availableStock: true } } } },
        payments: { include: { paymentMethod: { select: { name: true } } } },
      },
    });
    return draft
      ? { success: true, draft: serializePrisma(draft) }
      : { success: false, error: 'Venda guardada não encontrada.' };
  } catch {
    return { success: false, error: 'Não foi possível carregar a venda guardada.' };
  }
}
