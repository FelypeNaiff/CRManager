import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { buildPreviewRows, parseDeclaredDecimal, stockQuantity, textCell } from './product-import-preview';

test('preserves codes with zeros and hyphens as text', () => assert.equal(textCell('0012-AB', 'SKU'), '0012-AB'));
test('rejects numeric identifier cells instead of silently converting them', () => assert.throws(() => textCell(12, 'SKU'), /texto/));
test('parses declared Brazilian decimal and rejects ambiguous values', () => {
  assert.equal(parseDeclaredDecimal('1.234,56', 'BR').toFixed(2), '1234.56');
  assert.throws(() => parseDeclaredDecimal('1,234.56', 'BR'), /ambíguo/);
});
test('preserves explicit zero and rejects empty decimal cells', () => {
  assert.equal(parseDeclaredDecimal('0,00', 'BR').toFixed(2), '0.00');
  assert.throws(() => parseDeclaredDecimal('', 'BR'), /ausente/);
});
test('rejects formulas instead of trusting cached values', () => assert.throws(() => textCell('=A1+1', 'SKU'), /Fórmula/));
test('detects duplicate identities inside the file', () => {
  const preview = buildPreviewRows([{ rowNumber: 2, sku: '001' }, { rowNumber: 3, sku: '001' }]);
  assert.equal(preview[0].errors.length, 0);
  assert.match(preview[1].errors[0], /duplicada/);
});
test('purchase quantity conversion is explicit and does not reinterpret stock quantity', () => {
  assert.equal(stockQuantity({ quantity: 2, informedUnit: 'PURCHASE', factor: 12 }).toFixed(2), '24.00');
  assert.equal(stockQuantity({ quantity: 2, informedUnit: 'STOCK', factor: 12 }).toFixed(2), '2.00');
  assert.throws(() => stockQuantity({ quantity: 2, informedUnit: 'PURCHASE', factor: 0 }), /positivo/);
});
test('real XLSX preserves formula metadata and blank-row addresses for authoritative rejection', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['SKU', 'Preço de venda'], ['001', 10], [], ['002', 20]]);
  sheet.B2 = { t: 'n', f: '1+9', v: 10 };
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Produtos');
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const parsed = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
  assert.equal(parsed.Sheets.Produtos.B2.f, '1+9');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets.Produtos, { header: 1, raw: true, defval: undefined, blankrows: true });
  assert.equal(rows[3][0], '002');
});
