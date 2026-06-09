import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const IMPORTS_DIR = path.join(__dirname, '../imports');

function ensureDir() {
  if (!fs.existsSync(IMPORTS_DIR)) {
    fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  }
}

function generateCleanTestSheets() {
  ensureDir();
  console.log("Generating clean mock spreadsheets...");

  // 1. PRODUTOS CLEAN
  const prodHeaders = ["Código", "SKU", "Nome do produto *", "Preço de compra", "Preço de venda", "Código de barras (GTIN/EAN)", "Qtd. Estoque", "Grupo do Produto", "FORNECEDOR", "Tamanho", "Cor"];
  const prodData = [
    prodHeaders,
    ["2001", "SKU-2001", "Vestido Infantil clean", "25.00", "50.00", "7891111111111", "20", "Vestidos", "Fornecedor Kids", "4", "Rosa"],
    ["2002", "SKU-2002", "Conjunto Verão clean", "30.00", "60.00", "7891111111112", "30", "Conjuntos", "Fornecedor Boys", "6", "Azul"],
    ["2003", "SKU-2003", "Sapatinho Bebê clean", "15.00", "35.00", "7891111111113", "15", "Sapatos", "Fornecedor Baby", "20", "Branco"],
  ];
  const wbProd = XLSX.utils.book_new();
  const wsProd = XLSX.utils.aoa_to_sheet(prodData);
  XLSX.utils.book_append_sheet(wbProd, wsProd, "Produtos");
  XLSX.writeFile(wbProd, path.join(IMPORTS_DIR, 'produtos.xlsx'));

  // 2. CLIENTES CLEAN (Using unique phone numbers to prevent DB duplicate skips)
  const timestamp = Date.now().toString().slice(-6);
  const cliHeaders = ["Nome *", "Telefone *", "E-mail", "Data Nascimento", "Saldo Carteira"];
  const cliData = [
    cliHeaders,
    ["Joana Silva clean", `119555${timestamp}1`, "joanas@email.com", "1990-05-15", "100.00"],
    ["Carlos Souza clean", `119555${timestamp}2`, "carloss@email.com", "1988-10-20", "50.00"],
    ["Paula Abreu clean", `119555${timestamp}3`, "paula@email.com", "", "0.00"], // birthDate = null (warning only)
  ];
  const wbCli = XLSX.utils.book_new();
  const wsCli = XLSX.utils.aoa_to_sheet(cliData);
  XLSX.utils.book_append_sheet(wbCli, wsCli, "Clientes");
  XLSX.writeFile(wbCli, path.join(IMPORTS_DIR, 'clientes.xlsx'));

  // 3. VENDEDORES CLEAN
  const vendHeaders = ["Nome *", "Comissão (%) *", "Meta Mensal"];
  const vendData = [
    vendHeaders,
    ["Vendedor Especial 1", "5.0", "15000.00"],
    ["Vendedor Especial 2", "6.0", "20000.00"],
  ];
  const wbVend = XLSX.utils.book_new();
  const wsVend = XLSX.utils.aoa_to_sheet(vendData);
  XLSX.utils.book_append_sheet(wbVend, wsVend, "Vendedores");
  XLSX.writeFile(wbVend, path.join(IMPORTS_DIR, 'vendedores.xlsx'));

  console.log("Clean mock spreadsheets successfully created in: " + IMPORTS_DIR);
}

generateCleanTestSheets();
