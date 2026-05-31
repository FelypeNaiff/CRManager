import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting Phase 6A structural test...");
  
  try {
    const firstCompany = await prisma.company.findFirst();
    if (!firstCompany) {
      console.log("No company found, skipping write test.");
      return;
    }

    const firstUser = await prisma.user.findFirst({ where: { companyId: firstCompany.id } });
    if (!firstUser) {
      console.log("No user found, skipping write test.");
      return;
    }

    console.log("Testing Sale creation (structural)...");
    const testSale = await prisma.sale.create({
      data: {
        companyId: firstCompany.id,
        sellerId: firstUser.id,
        status: "PENDING",
        subtotal: 100.00,
        totalAmount: 100.00,
        notes: "Test Sale from Phase 6A",
        customerNameSnapshot: "Structural Test User"
      }
    });
    
    console.log(`Sale created successfully with ID: ${testSale.id}`);

    // Cleanup
    await prisma.sale.delete({
      where: { id: testSale.id }
    });
    console.log("Test sale cleaned up.");

    console.log("[PASS] Phase 6A Structural Test completed successfully.");
  } catch (error) {
    console.error("[FAIL] Error during structural test:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
