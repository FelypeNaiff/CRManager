'use server';

import { createHash, randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { buildPreviewRows, parseDeclaredDecimal, PRODUCT_IMPORT_PARSER_VERSION, textCell } from './product-import-preview';
import type { ImportRowStatus, ImportStockPolicy } from '@prisma/client';
import { applyCanonicalImportStock, createCanonicalProduct, updateCanonicalProduct } from '@/lib/crm/product-write-service';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1000;
const aliases = {
  internalCode: ['código', 'codigo', 'código interno', 'codigo interno'],
  sku: ['sku'], barcode: ['código de barras (gtin/ean)', 'codigo de barras', 'gtin', 'ean'],
  name: ['nome do produto *', 'nome do produto'], cost: ['preço de compra', 'preco de compra', 'custo'],
  price: ['preço de venda', 'preco de venda'], quantity: ['qtd. estoque', 'quantidade em estoque'],
  unit: ['unidade'], ncm: ['ncm'], category: ['grupo do produto'], supplier: ['fornecedor'],
} as const;

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveColumns(headers: unknown[], supplied?: unknown) {
  const normalized = headers.map(normalizeHeader);
  const suppliedObject = supplied && typeof supplied === 'object' && !Array.isArray(supplied) ? supplied as Record<string, unknown> : undefined;
  const automatic = Object.fromEntries(Object.entries(aliases).map(([field, values]) => {
    const accepted = values.map(normalizeHeader);
    const matches = normalized.map((value, index) => accepted.includes(value) ? index : -1).filter(index => index >= 0);
    if (matches.length > 1 && suppliedObject?.[field] === undefined) throw new Error(`Mapeamento ambíguo para ${field}; selecione a coluna.`);
    return [field, matches[0] ?? -1];
  })) as Record<keyof typeof aliases, number>;
  if (supplied === undefined) return automatic;
  if (!suppliedObject) throw new Error('Mapeamento inválido.');
  const result = { ...automatic };
  const used = new Set<number>();
  for (const field of Object.keys(aliases) as (keyof typeof aliases)[]) {
    const value = suppliedObject[field];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || Number(value) < -1 || Number(value) >= headers.length) throw new Error(`Índice inválido para ${field}.`);
    const index = Number(value);
    if (index >= 0 && used.has(index)) throw new Error('Uma coluna não pode mapear dois campos.');
    if (index >= 0) used.add(index);
    result[field] = index;
  }
  return result;
}

export async function createProductImportPreviewAction(formData: FormData) {
  const auth = await requirePermission('PRODUTOS', 'IMPORT');
  const file = formData.get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Envie um arquivo XLSX.');
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('O XLSX deve ter no máximo 2 MB.');
  const existingPolicy = String(formData.get('existingPolicy') ?? 'UPDATE');
  const decimalFormat = String(formData.get('decimalFormat') ?? 'BR');
  if (!['BR', 'DOT'].includes(decimalFormat)) throw new Error('Formato decimal inválido.');
  const stockPolicy = String(formData.get('stockPolicy') ?? 'NONE') as ImportStockPolicy;
  if (!['CREATE', 'UPDATE', 'IGNORE'].includes(existingPolicy)) throw new Error('Política de existentes inválida.');
  if (!['NONE', 'INITIAL_IF_NO_HISTORY', 'TARGET_BALANCE', 'ADDITIONAL_ENTRY'].includes(stockPolicy)) throw new Error('Política de estoque inválida.');
  if (stockPolicy !== 'NONE') await requirePermission('ESTOQUE', 'IMPORT');
  if (existingPolicy === 'UPDATE') await requirePermission('PRODUTOS', 'UPDATE');

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const workbook = XLSX.read(bytes, { type: 'buffer', cellFormula: true, cellText: false, cellDates: true });
  if (workbook.Workbook?.WBProps?.CodeName) throw new Error('Arquivos com recursos de macro não são permitidos.');
  const sheetName = String(formData.get('sheetName') || workbook.SheetNames.find(name => normalizeHeader(name).includes('produto')) || workbook.SheetNames[0]);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('Aba selecionada não encontrada.');
  for (const [address, cell] of Object.entries(worksheet)) {
    if (!address.startsWith('!') && (cell as XLSX.CellObject).f) throw new Error(`Fórmula não permitida em ${sheetName}!${address}.`);
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: undefined, blankrows: true });
  if (matrix.length < 2) throw new Error('Planilha vazia ou sem dados.');
  const suppliedMapping = formData.get('mapping');
  const mapping = resolveColumns(matrix[0], suppliedMapping ? JSON.parse(String(suppliedMapping)) : undefined);
  if (mapping.name < 0) throw new Error('Coluna exata de nome do produto não encontrada.');
  const rawRows = matrix.slice(1).map((row, offset) => ({ row, rowNumber: offset + 2 })).filter(({ row }) => row.some(value => value !== undefined && value !== null && value !== ''));
  if (rawRows.length > MAX_ROWS) throw new Error(`Limite de ${MAX_ROWS} linhas excedido.`);

  const parsed = rawRows.map(({ row, rowNumber }) => {
    const validationErrors: string[] = [];
    const idCell = (index: number, field: string) => {
      if (index < 0 || row[index] === undefined || row[index] === '') return undefined;
      try { return textCell(row[index], `${field} (${sheetName}!${XLSX.utils.encode_cell({ r: rowNumber - 1, c: index })})`); }
      catch (error) { validationErrors.push((error as Error).message); return undefined; }
    };
    const decimalCell = (index: number, field: string) => {
      if (index < 0 || row[index] === undefined || row[index] === '') return undefined;
      try { return parseDeclaredDecimal(row[index], decimalFormat as 'BR' | 'DOT').toString(); }
      catch (error) { validationErrors.push(`${field}: ${(error as Error).message}`); return undefined; }
    };
    const name = row[mapping.name];
    if (typeof name !== 'string' || !name.trim()) validationErrors.push('Nome do produto deve ser texto não vazio.');
    return {
      rowNumber, validationErrors,
      internalCode: idCell(mapping.internalCode, 'Código interno'), sku: idCell(mapping.sku, 'SKU'), barcode: idCell(mapping.barcode, 'GTIN'),
      name, cost: decimalCell(mapping.cost, 'Preço de compra'), price: decimalCell(mapping.price, 'Preço de venda'),
      quantity: decimalCell(mapping.quantity, 'Quantidade'), informedUnit: 'STOCK' as const,
      unit: mapping.unit < 0 ? undefined : row[mapping.unit], ncm: mapping.ncm < 0 ? undefined : row[mapping.ncm],
      category: mapping.category < 0 ? undefined : row[mapping.category], supplier: mapping.supplier < 0 ? undefined : row[mapping.supplier],
    };
  });
  const preview = buildPreviewRows(parsed);
  const skus = preview.flatMap(row => row.sku ? [row.sku] : []);
  const barcodes = preview.flatMap(row => row.barcode ? [row.barcode] : []);
  const internalCodes = preview.flatMap(row => row.internalCode ? [row.internalCode] : []);
  const variants = await prisma.productVariant.findMany({
    where: { companyId: auth.companyId, OR: [
      ...(skus.length ? [{ sku: { in: skus } }] : []),
      ...(barcodes.length ? [{ barcode: { in: barcodes } }] : []),
      ...(internalCodes.length ? [{ product: { internalCode: { in: internalCodes } } }] : []),
    ] },
    select: { id: true, productId: true, sku: true, barcode: true, name: true, costPrice: true, salePrice: true,
      currentStock: true, availableStock: true, product: { select: { internalCode: true, name: true } } },
  });
  const bySku = new Map(variants.map(variant => [variant.sku, variant]));
  const byBarcode = new Map(variants.filter(variant => variant.barcode).map(variant => [variant.barcode!, variant]));
  const byCode = new Map<string, typeof variants>();
  for (const variant of variants) {
    const code = variant.product.internalCode;
    byCode.set(code, [...(byCode.get(code) ?? []), variant]);
  }
  const seenVariants = new Map<string, number>();
  const resolvedPreview = preview.map(row => {
    const errors = [...row.errors];
    const candidates = new Map<string, (typeof variants)[number]>();
    if (row.sku && bySku.get(row.sku)) candidates.set(bySku.get(row.sku)!.id, bySku.get(row.sku)!);
    if (row.barcode && byBarcode.get(row.barcode)) candidates.set(byBarcode.get(row.barcode)!.id, byBarcode.get(row.barcode)!);
    const codeMatches = row.internalCode ? (byCode.get(row.internalCode) ?? []) : [];
    if (codeMatches.length === 1) candidates.set(codeMatches[0].id, codeMatches[0]);
    if (codeMatches.length > 1 && !row.sku && !row.barcode) errors.push('Código interno identifica um produto com várias variantes; informe SKU ou GTIN.');
    if (candidates.size > 1) errors.push('SKU, GTIN e código interno apontam para variantes diferentes.');
    const target = candidates.size === 1 ? [...candidates.values()][0] : undefined;
    if (target) {
      const previousRow = seenVariants.get(target.id);
      if (previousRow) errors.push(`A mesma variante já foi resolvida pela linha ${previousRow}.`);
      else seenVariants.set(target.id, row.rowNumber);
    }
    const proposedAction = target ? existingPolicy : 'CREATE';
    if (target && existingPolicy === 'CREATE') errors.push('Registro já existe e a política selecionada permite apenas criação.');
    const status: ImportRowStatus = errors.length ? 'BLOCKED' : proposedAction === 'IGNORE' ? 'IGNORED' : 'READY';
    return { ...row, errors, status, proposedAction, productId: target?.productId, variantId: target?.id,
      previewData: { target: target ? { productId: target.productId, variantId: target.id, internalCode: target.product.internalCode,
        sku: target.sku, barcode: target.barcode, name: target.name } : null,
        current: target ? { name: target.product.name, variantName: target.name, cost: target.costPrice.toString(),
          price: target.salePrice.toString(), stock: target.currentStock.toString(), availableStock: target.availableStock.toString() } : null,
        proposed: { name: row.name, cost: row.cost, price: row.price }, stockEffect: stockPolicy === 'NONE' ? null : row.convertedQuantity?.toString() ?? null } };
  });
  const fingerprint = createHash('sha256').update(JSON.stringify({ companyId: auth.companyId, contentHash, sheetName,
    parser: PRODUCT_IMPORT_PARSER_VERSION, mapping, existingPolicy, stockPolicy, decimalFormat })).digest('hex');

  try {
    const batch = await prisma.$transaction(async tx => {
      const created = await tx.importBatch.create({ data: {
      companyId: auth.companyId, createdByUserId: auth.userId, contentHash, fingerprint, parserVersion: PRODUCT_IMPORT_PARSER_VERSION,
      mapping: { sheetName, columns: mapping, fileHash: contentHash }, policies: { existingPolicy, stockPolicy }, status: 'READY',
      totalRows: resolvedPreview.length, errorRows: resolvedPreview.filter(row => row.errors.length).length,
      rows: { create: resolvedPreview.map(row => ({ rowNumber: row.rowNumber, operationKey: row.operationKey,
        status: row.status, proposedAction: row.proposedAction, sourceData: JSON.parse(JSON.stringify(row)), previewData: JSON.parse(JSON.stringify(row.previewData)),
        errors: row.errors, productId: row.productId, variantId: row.variantId, stockPolicy,
        previewStock: row.previewData.current?.stock, originalQuantity: row.quantity, originalUnit: row.informedUnit })) as Prisma.ImportBatchRowCreateWithoutBatchInput[] },
      }, select: { id: true, status: true, totalRows: true, errorRows: true, rows: { select: { rowNumber: true, status: true, operationKey: true, errors: true }, orderBy: { rowNumber: 'asc' } } } });
      return { success: true, duplicate: false, batchId: created.id, status: created.status, totalRows: created.totalRows, errorRows: created.errorRows, rows: created.rows };
    });
    return batch;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.importBatch.findUnique({ where: { fingerprint }, select: { id: true, status: true, totalRows: true, errorRows: true,
        rows: { select: { rowNumber: true, status: true, operationKey: true, errors: true }, orderBy: { rowNumber: 'asc' } } } });
      if (existing) return { success: true, duplicate: true, batchId: existing.id, ...existing };
    }
    throw error;
  }
}

const batchSelect = {
  id: true, status: true, totalRows: true, completedRows: true, errorRows: true, mapping: true, policies: true,
  createdAt: true, startedAt: true, completedAt: true,
  rows: { select: { id: true, rowNumber: true, status: true, proposedAction: true, operationKey: true,
    previewData: true, errors: true, warnings: true, productId: true, variantId: true, attemptCount: true, processedAt: true },
    orderBy: { rowNumber: 'asc' as const } },
} satisfies Prisma.ImportBatchSelect;

export async function getProductImportBatchAction(batchId: string) {
  const auth = await requirePermission('PRODUTOS', 'IMPORT');
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId: auth.companyId }, select: batchSelect });
  if (!batch) throw new Error('Lote não encontrado.');
  return JSON.parse(JSON.stringify(batch));
}

export async function confirmProductImportBatchAction(batchId: string) {
  const auth = await requirePermission('PRODUTOS', 'IMPORT');
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId: auth.companyId }, select: { id: true, status: true, errorRows: true } });
  if (!batch) throw new Error('Lote não encontrado.');
  if (['PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED_RECOVERABLE'].includes(batch.status)) return getProductImportBatchAction(batchId);
  if (batch.status !== 'READY') throw new Error('O lote não está disponível para confirmação.');
  const changed = await prisma.importBatch.updateMany({ where: { id: batchId, companyId: auth.companyId, status: 'READY' },
    data: { status: 'PROCESSING', startedAt: new Date() } });
  if (!changed.count) return getProductImportBatchAction(batchId);
  return getProductImportBatchAction(batchId);
}

type ImportSource = { name?: unknown; internalCode?: unknown; sku?: unknown; barcode?: unknown; cost?: unknown; price?: unknown;
  unit?: unknown; ncm?: unknown; supplier?: unknown; convertedQuantity?: unknown };

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} inválido durante o processamento.`);
  return value.trim();
}

export async function processProductImportBatchAction(batchId: string, limit = 25) {
  const auth = await requirePermission('PRODUTOS', 'IMPORT');
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId: auth.companyId }, select: { id: true, status: true, policies: true } });
  if (!batch) throw new Error('Lote não encontrado.');
  if (!['PROCESSING', 'FAILED_RECOVERABLE'].includes(batch.status)) return getProductImportBatchAction(batchId);
  const policies = batch.policies as { stockPolicy?: ImportStockPolicy };
  if (policies.stockPolicy && policies.stockPolicy !== 'NONE') await requirePermission('ESTOQUE', 'IMPORT');
  const candidates = await prisma.importBatchRow.findMany({ where: { batchId, OR: [
    { status: { in: ['READY', 'FAILED'] } }, { status: 'PROCESSING', leaseExpiresAt: { lt: new Date() } },
  ] }, select: { id: true }, orderBy: { rowNumber: 'asc' }, take: Math.max(1, Math.min(100, limit)) });

  for (const candidate of candidates) {
    const token = randomUUID();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + 60_000);
    const claimed = await prisma.importBatchRow.updateMany({ where: { id: candidate.id, batchId, OR: [
      { status: { in: ['READY', 'FAILED'] } }, { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
    ] }, data: { status: 'PROCESSING', processingToken: token, leaseExpiresAt, attemptCount: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      await prisma.$transaction(async tx => {
        const row = await tx.importBatchRow.findFirst({ where: { id: candidate.id, batchId, processingToken: token,
          status: 'PROCESSING', leaseExpiresAt: { gt: new Date() }, batch: { companyId: auth.companyId } } });
        if (!row) throw new Error('Posse da linha expirada ou perdida.');
        const source = row.sourceData as ImportSource;
        const name = requiredText(source.name, 'Nome');
        const internalCode = typeof source.internalCode === 'string' && source.internalCode.trim()
          ? source.internalCode.trim() : requiredText(source.sku ?? source.barcode, 'Código interno');
        const sku = typeof source.sku === 'string' && source.sku.trim() ? source.sku.trim() : `SKU-${internalCode}`;
        const write = { name, internalCode, sku, barcode: typeof source.barcode === 'string' ? source.barcode : null,
          costPrice: typeof source.cost === 'string' ? source.cost : undefined, salePrice: typeof source.price === 'string' ? source.price : undefined,
          unit: typeof source.unit === 'string' ? source.unit : null, ncm: typeof source.ncm === 'string' ? source.ncm : null,
          supplierName: typeof source.supplier === 'string' ? source.supplier : null };
        let target: { product: { id: string }; variant: { id: string } };
        if (row.proposedAction === 'CREATE') {
          await requirePermission('PRODUTOS', 'CREATE');
          target = await createCanonicalProduct(tx, auth, write);
        } else if (row.proposedAction === 'UPDATE') {
          await requirePermission('PRODUTOS', 'UPDATE');
          if (!row.productId || !row.variantId) throw new Error('Alvo da atualização não está definido.');
          target = await updateCanonicalProduct(tx, auth, row.productId, row.variantId, write);
        } else throw new Error('Ação de processamento inválida.');
        const quantity = source.convertedQuantity === null || source.convertedQuantity === undefined
          ? new Prisma.Decimal(0) : new Prisma.Decimal(String(source.convertedQuantity));
        await applyCanonicalImportStock(tx, auth, { importRowId: row.id, variantId: target.variant.id,
          policy: row.stockPolicy, quantity, previewStock: row.previewStock });
        const done = await tx.importBatchRow.updateMany({ where: { id: row.id, processingToken: token, status: 'PROCESSING' }, data: {
          status: 'COMPLETED', productId: target.product.id, variantId: target.variant.id, processedAt: new Date(),
          processingToken: null, leaseExpiresAt: null, errors: Prisma.JsonNull,
        } });
        if (!done.count) throw new Error('A linha perdeu a posse antes da conclusão.');
      });
    } catch (error) {
      await prisma.importBatchRow.updateMany({ where: { id: candidate.id, processingToken: token, status: 'PROCESSING' }, data: {
        status: error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ? 'CONFLICT' : 'FAILED',
        processingToken: null, leaseExpiresAt: null, errors: [(error as Error).message],
      } });
    }
  }
  const counts = await prisma.importBatchRow.groupBy({ by: ['status'], where: { batchId }, _count: { _all: true } });
  const count = Object.fromEntries(counts.map(item => [item.status, item._count._all]));
  const pending = (count.READY ?? 0) + (count.PROCESSING ?? 0);
  const retryable = count.FAILED ?? 0;
  const errors = (count.BLOCKED ?? 0) + (count.FAILED ?? 0) + (count.CONFLICT ?? 0);
  await prisma.importBatch.updateMany({ where: { id: batchId, companyId: auth.companyId }, data: {
    completedRows: count.COMPLETED ?? 0, errorRows: errors,
    status: pending || retryable ? 'FAILED_RECOVERABLE' : errors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
    ...(pending || retryable ? {} : { completedAt: new Date() }),
  } });
  return getProductImportBatchAction(batchId);
}
