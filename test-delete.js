const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Creating user...");
    const user = await prisma.user.create({
      data: {
        id: "test-delete-123",
        companyId: "some-company",
        name: "Test",
        email: "testdelete@example.com",
        pinAccessHash: "asd",
      }
    });
    console.log("User created:", user.id);

    console.log("Attempting delete with {id, companyId}...");
    await prisma.user.delete({
      where: {
        id: "test-delete-123",
        companyId: "some-company"
      }
    });
    console.log("Delete successful!");
  } catch (err) {
    console.error("ERROR TYPE:", err.name);
    console.error("ERROR CODE:", err.code);
    console.error("ERROR MSG:", err.message);
  } finally {
    // cleanup
    await prisma.user.deleteMany({ where: { id: "test-delete-123" } });
    await prisma.();
  }
}
main();