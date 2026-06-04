import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();

  if (user && user.roleId) {
    await prisma.role.update({
      where: { id: user.roleId },
      data: { isAdmin: true }
    });
    console.log(`Role updated to admin for user ${user.email}!`);
  } else {
    console.log('No user with a roleId found.');
  }
}

main().finally(() => prisma.$disconnect());
