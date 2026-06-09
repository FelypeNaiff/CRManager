import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const IMPORTS_DIR = path.join(__dirname, '../imports');

function ensureDir() {
  if (!fs.existsSync(IMPORTS_DIR)) {
    fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  }
}

function generateTestSheets() {
  ensureDir();
  console.log("Generating mock spreadsheets with both valid and invalid rows to test validation...");

  // 1. PRODUTOS TEST
  const prodHeaders = ["Código", "SKU", "Nome do produto *", "Preço de compra", "Preço de venda", "Código de barras (GTIN/EAN)", "Qtd. Estoque", "Grupo do Produto", "FORNECEDOR"];
  const prodData = [
    prodHeaders,
    ["1001", "SKU-001", "Vestido Infantil Florido", "25.00", "50.00", "7891000000001", "10", "Vestidos", "Fornecedor Kids"], // Valid
    ["1002", "SKU-002", "Conjunto Verão Menino", "30.00", "60.00", "7891000000002", "15", "Conjuntos", "Fornecedor Boys"], // Valid
    ["1003", "SKU-001", "Duplicado de Vestido", "25.00", "50.00", "7891000000003", "5", "Vestidos", "Fornecedor Kids"], // Duplicate SKU (Error)
    ["1004", "SKU-003", "Sapatinho Bebê", "15.00", "0.00", "7891000000002", "8", "Sapatos", "Fornecedor Baby"], // Zero price & duplicate Barcode (Errors)
    ["1005", "SKU-004", "Camisa Polo Infantil", "0.00", "30.00", "7891000000004", "-2", "Camisas", "Fornecedor Boys"], // Zero cost & negative stock (Errors)
  ];
  const wbProd = XLSX.utils.book_new();
  const wsProd = XLSX.utils.aoa_to_sheet(prodData);
  XLSX.utils.book_append_sheet(wbProd, wsProd, "Produtos");
  XLSX.writeFile(wbProd, path.join(IMPORTS_DIR, 'produtos.xlsx'));

  // 2. CLIENTES TEST
  const cliHeaders = ["Nome *", "Telefone *", "E-mail", "Data Nascimento"];
  const cliData = [
    cliHeaders,
    ["Joana Silva", "11988888888", "joana@email.com", "1990-05-15"], // Valid
    ["Maria Souza", "11977777777", "maria@email.com", ""], // Missing birthday (Warning)
    ["Carlos Souza", "11988888888", "carlos@email.com", "1988-10-20"], // Duplicate Phone (Error, reject both)
    ["Cliente Sem Telefone", "", "sem_tel@email.com", "2000-01-01"], // Missing Phone (Error)
  ];
  const wbCli = XLSX.utils.book_new();
  const wsCli = XLSX.utils.aoa_to_sheet(cliData);
  XLSX.utils.book_append_sheet(wbCli, wsCli, "Clientes");
  XLSX.writeFile(wbCli, path.join(IMPORTS_DIR, 'clientes.xlsx'));

  // 3. VENDEDORES TEST
  const vendHeaders = ["Nome *", "Comissão (%) *", "Meta Mensal"];
  const vendData = [
    vendHeaders,
    ["Vendedor 1", "5.0", "15000.00"], // Valid
    ["Vendedor Sem Comissão", "", "10000.00"], // Missing commission (Error)
  ];
  const wbVend = XLSX.utils.book_new();
  const wsVend = XLSX.utils.aoa_to_sheet(vendData);
  XLSX.utils.book_append_sheet(wbVend, wsVend, "Vendedores");
  XLSX.writeFile(wbVend, path.join(IMPORTS_DIR, 'vendedores.xlsx'));

  console.log("Mock spreadsheets successfully created in: " + IMPORTS_DIR);
}

generateTestSheets();
