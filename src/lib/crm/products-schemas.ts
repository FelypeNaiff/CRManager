import { z } from 'zod';

export const ProductCategorySchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório'),
  description: z.string().optional().nullable(),
});

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Nome do fornecedor é obrigatório'),
  cnpjCpf: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
});

export const ProductVariantInputSchema = z.object({
  name: z.string().min(1, 'Nome da variação é obrigatório'),
  sku: z.string().min(1, 'SKU é obrigatório'),
  barcode: z.string().optional().nullable(),
  barcodeType: z.string().optional().nullable(),
  costPrice: z.number().min(0, 'Preço de custo deve ser maior ou igual a 0'),
  salePrice: z.number().min(0, 'Preço de venda deve ser maior ou igual a 0'),
  minimumStock: z.number().min(0, 'Estoque mínimo deve ser maior ou igual a 0').default(0),
});

export const ProductSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  internalCode: z.string().min(1, 'Código interno é obrigatório'),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')).nullable(),
  thumbnailUrl: z.string().url('URL inválida').optional().or(z.literal('')).nullable(),
  galleryUrls: z.array(z.string().url('URL inválida')).default([]),
  
  // Para simplificar a criação simplificada (variante única)
  costPrice: z.number().min(0, 'Preço de custo deve ser maior ou igual a 0').optional(),
  salePrice: z.number().min(0, 'Preço de venda deve ser maior ou igual a 0').optional(),
  sku: z.string().optional(),
  barcode: z.string().optional().nullable(),
  barcodeType: z.string().optional().nullable(),
  minimumStock: z.number().min(0, 'Estoque mínimo deve ser maior ou igual a 0').default(0).optional(),
});

export const InventoryMovementSchema = z.object({
  variantId: z.string().min(1, 'Variante é obrigatória'),
  quantity: z.number().refine(v => v !== 0, 'Quantidade não pode ser zero'),
  type: z.enum([
    'INITIAL',
    'PURCHASE',
    'SALE',
    'RETURN',
    'EXCHANGE',
    'LOSS',
    'DAMAGE',
    'MANUAL_ADJUSTMENT',
    'TRANSFER',
    'RESERVATION',
    'CANCELLATION'
  ]),
  reason: z.string().optional().nullable(),
  warehouseId: z.string().default('LOJA_PRINCIPAL'),
});
