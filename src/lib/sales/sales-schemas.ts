import { z } from "zod";

export const SaleStatusSchema = z.enum(["PENDING", "PAID", "CANCELLED"]);

export const createSaleSchema = z.object({
  companyId: z.string(),
  sellerId: z.string(),
  customerId: z.string().optional(),
  cashRegisterId: z.string().optional(),
  subtotal: z.number().min(0),
  discountAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0),
  notes: z.string().optional(),
  customerNameSnapshot: z.string().optional(),
  customerPhoneSnapshot: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string(),
    quantity: z.number().min(0.01),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).optional().default(0),
    totalPrice: z.number().min(0),
    productNameSnapshot: z.string(),
    variantNameSnapshot: z.string(),
    skuSnapshot: z.string(),
    barcodeSnapshot: z.string().optional(),
    costPriceAtSale: z.number().min(0),
    salePriceAtSale: z.number().min(0),
    marginAtSale: z.number()
  })).min(1),
  payments: z.array(z.object({
    paymentMethodId: z.string(),
    amount: z.number().min(0.01),
    installments: z.number().int().min(1).optional().default(1)
  })).min(1),
  authPin: z.string().optional(),
  authReason: z.string().optional()
});

export const cancelSaleSchema = z.object({
  saleId: z.string(),
  cancelReason: z.string().min(3),
  cancelledByUserId: z.string()
});

export const exchangeReturnSchema = z.object({
  originalSaleId: z.string(),
  customerId: z.string().optional(),
  type: z.enum(["EXCHANGE", "RETURN"]),
  exchangeReason: z.string().min(3),
  items: z.array(z.object({
    variantId: z.string(),
    quantity: z.number().min(0.01),
    condition: z.enum(["RESALE", "DAMAGED", "DISCARD"])
  })).min(1)
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
export type ExchangeReturnInput = z.infer<typeof exchangeReturnSchema>;
