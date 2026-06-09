import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importFinancialData() {
  console.log("==================================================");
  console.log("NEEX FINANCIAL INITIALIZER (GO-LIVE-04)");
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database.");
    process.exit(1);
  }

  const activeUser = await prisma.user.findFirst({
    where: { companyId: company.id, status: "ACTIVE" }
  });
  if (!activeUser) {
    console.error("  [FAIL] No active user found to open cash register.");
    process.exit(1);
  }

  // 1. Create Main Bank Account
  console.log("Setting up Bank Accounts...");
  let bankAccount = await prisma.bankAccount.findFirst({
    where: { companyId: company.id, isCashAccount: false }
  });

  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({
      data: {
        companyId: company.id,
        name: "Conta Corrente Principal",
        bankName: "Banco do Brasil",
        agency: "1234-5",
        accountNumber: "98765-4",
        initialBalance: 10000.00,
        currentBalance: 10000.00,
        isCashAccount: false,
        isActive: true
      }
    });
    console.log(`  [CREATE] Created main bank account: ${bankAccount.name}`);
  } else {
    console.log(`  [EXIST] Main bank account already exists.`);
  }

  // 2. Create Cash Bank Account & Open Cash Register
  console.log("\nSetting up Cash Registers...");
  let cashBankAccount = await prisma.bankAccount.findFirst({
    where: { companyId: company.id, isCashAccount: true }
  });

  if (!cashBankAccount) {
    cashBankAccount = await prisma.bankAccount.create({
      data: {
        companyId: company.id,
        name: "Caixa Físico da Loja",
        bankName: "Dinheiro em Caixa",
        initialBalance: 500.00,
        currentBalance: 500.00,
        isCashAccount: true,
        isActive: true
      }
    });
    console.log(`  [CREATE] Created cash bank account: ${cashBankAccount.name}`);
  }

  let activeRegister = await prisma.cashRegister.findFirst({
    where: { companyId: company.id, status: "OPEN" }
  });

  if (!activeRegister) {
    activeRegister = await prisma.cashRegister.create({
      data: {
        companyId: company.id,
        openedByUserId: activeUser.id,
        bankAccountId: cashBankAccount.id,
        status: "OPEN",
        openingBalance: 500.00,
        expectedBalance: 500.00
      }
    });
    console.log(`  [CREATE] Opened Main Cash Register (Opening balance: R$ 500,00)`);
  } else {
    console.log(`  [EXIST] Active Cash Register already open.`);
  }

  // 3. Create Chart of Accounts (FinancialAccount hierarchy)
  console.log("\nSetting up Chart of Accounts...");

  const accounts = [
    { code: "1", name: "Receitas", type: "INCOME", parentCode: null, acceptsEntries: false },
    { code: "1.1", name: "Vendas", type: "INCOME", parentCode: "1", acceptsEntries: true },
    
    { code: "2", name: "Custos", type: "EXPENSE", parentCode: null, acceptsEntries: false },
    { code: "2.1", name: "Mercadorias", type: "EXPENSE", parentCode: "2", acceptsEntries: true },
    
    { code: "3", name: "Despesas", type: "EXPENSE", parentCode: null, acceptsEntries: false },
    { code: "3.1", name: "Aluguel", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.2", name: "Energia", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.3", name: "Internet", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.4", name: "Salários", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.5", name: "Encargos", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.6", name: "Marketing", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.7", name: "Cartão", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
    { code: "3.8", name: "Diversos", type: "EXPENSE", parentCode: "3", acceptsEntries: true },
  ];

  const codeIdMap = new Map<string, string>();

  for (const acc of accounts) {
    const parentId = acc.parentCode ? codeIdMap.get(acc.parentCode) || null : null;

    let dbAcc = await prisma.financialAccount.findUnique({
      where: {
        companyId_code: {
          companyId: company.id,
          code: acc.code
        }
      }
    });

    if (dbAcc) {
      console.log(`  [EXIST] Account ${acc.code} - ${acc.name}`);
      codeIdMap.set(acc.code, dbAcc.id);
    } else {
      dbAcc = await prisma.financialAccount.create({
        data: {
          companyId: company.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          parentId,
          acceptsEntries: acc.acceptsEntries,
          isActive: true
        }
      });
      console.log(`  [CREATE] Created Account ${acc.code} - ${acc.name}`);
      codeIdMap.set(acc.code, dbAcc.id);
    }
  }

  // 4. Create Cost Centers
  console.log("\nSetting up Cost Centers...");
  const costCenters = [
    { name: "Administração", code: "ADM" },
    { name: "Comercial / Loja", code: "COM" }
  ];

  for (const cc of costCenters) {
    let dbCc = await prisma.costCenter.findUnique({
      where: {
        companyId_name: {
          companyId: company.id,
          name: cc.name
        }
      }
    });

    if (dbCc) {
      console.log(`  [EXIST] Cost Center: ${cc.name}`);
    } else {
      dbCc = await prisma.costCenter.create({
        data: {
          companyId: company.id,
          name: cc.name,
          code: cc.code,
          isActive: true
        }
      });
      console.log(`  [CREATE] Created Cost Center: ${cc.name}`);
    }
  }

  console.log("\n==================================================");
  console.log("FINANCIAL INITIALIZATION COMPLETE");
  console.log("==================================================");
}

importFinancialData()
  .catch(err => {
    console.error("Critical error in importFinancialData:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
