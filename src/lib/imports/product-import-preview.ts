import { Prisma, type ImportStockPolicy } from '@prisma/client';

export const PRODUCT_IMPORT_PARSER_VERSION = 'products-xlsx-v2';

export function parseDeclaredDecimal(value: unknown, format: 'BR' | 'DOT') {
  if (typeof value === 'number' && Number.isFinite(value)) return new Prisma.Decimal(value);
  if (typeof value !== 'string' || !value.trim()) throw new Error('Valor numérico ausente.');
  const raw = value.trim();
  if (raw.startsWith('=')) throw new Error('Fórmulas não são permitidas.');
  if (format === 'BR') {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(raw)) throw new Error('Número ambíguo para o formato brasileiro.');
    return new Prisma.Decimal(raw.replace(/\./g, '').replace(',', '.'));
  }
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error('Número ambíguo para o formato decimal com ponto.');
  return new Prisma.Decimal(raw);
}

export function textCell(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`${field} deve ser importado como texto para preservar zeros e hífens.`);
  const result = value.trim();
  if (result.startsWith('=')) throw new Error(`Fórmula não permitida em ${field}.`);
  return result;
}

export function identityKey(row: { sku?: string; barcode?: string; internalCode?: string }) {
  if (row.sku) return `SKU:${row.sku}`;
  if (row.barcode) return `BARCODE:${row.barcode}`;
  if (row.internalCode) return `CODE:${row.internalCode}`;
  throw new Error('Informe SKU, código de barras ou código interno.');
}

export function stockQuantity(input: {
  quantity: Prisma.Decimal.Value;
  informedUnit: 'STOCK' | 'PURCHASE';
  factor?: Prisma.Decimal.Value;
}) {
  const quantity = new Prisma.Decimal(input.quantity);
  if (input.informedUnit === 'STOCK') return quantity;
  const factor = new Prisma.Decimal(input.factor ?? 0);
  if (factor.lte(0)) throw new Error('Fator de conversão deve ser positivo.');
  return quantity.mul(factor);
}

export type PreviewRowInput = {
  rowNumber: number;
  name?: unknown;
  cost?: string;
  price?: string;
  sku?: string;
  barcode?: string;
  internalCode?: string;
  stockPolicy?: ImportStockPolicy;
  quantity?: Prisma.Decimal.Value;
  informedUnit?: 'STOCK' | 'PURCHASE';
  factor?: Prisma.Decimal.Value;
  validationErrors?: string[];
  [key: string]: unknown;
};

export function buildPreviewRows(rows: PreviewRowInput[]) {
  const seen = new Set<string>();
  return rows.map(row => {
    try {
      if (row.validationErrors?.length) throw new Error(row.validationErrors.join(' '));
      const operationKey = identityKey(row);
      if (seen.has(operationKey)) throw new Error(`Identidade duplicada no arquivo: ${operationKey}.`);
      seen.add(operationKey);
      const convertedQuantity = row.quantity === undefined ? null : stockQuantity({
        quantity: row.quantity,
        informedUnit: row.informedUnit ?? 'STOCK',
        factor: row.factor,
      });
      return { ...row, operationKey, convertedQuantity, errors: [] as string[] };
    } catch (error) {
      return { ...row, operationKey: `ROW:${row.rowNumber}`, convertedQuantity: null, errors: [(error as Error).message] };
    }
  });
}
