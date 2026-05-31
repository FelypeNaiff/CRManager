import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tablesToTest = [
    prisma.company.findFirst(),
    prisma.user.findFirst(),
    prisma.role.findFirst(),
    prisma.permission.findFirst(),
    prisma.customer.findFirst(),
    prisma.customerChild.findFirst(),
    prisma.customerWallet.findFirst(),
    prisma.product.findFirst(),
    prisma.productVariant.findFirst(),
    prisma.inventoryMovement.findFirst(),
    prisma.bankAccount.findFirst(),
    prisma.cashRegister.findFirst(),
    prisma.financialTransaction.findFirst(),
    prisma.accountsReceivable.findFirst(),
    prisma.paymentMethod.findFirst(),
  ];

  try {
    await Promise.all(tablesToTest);
    console.log("SUCESSO_TODAS_AS_TABELAS_ACESSIVEIS");
  } catch (error) {
    console.error("ERRO_AO_ACESSAR_TABELAS:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
