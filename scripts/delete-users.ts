import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'trupekidsmcp@gmail.com', // Acesso Operacional Trupe Kids
    'flavianevendas@gmail.com', // FLAVIANE
    'kathuciavendas@gmail.com', // KATHUCIA
  ];

  for (const email of emails) {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      console.log(`Usuário não encontrado: ${email}`);
      continue;
    }

    try {
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`Usuário excluído fisicamente: ${user.name}`);
    } catch (e: any) {
      if (e.code === 'P2003') {
        // Soft delete
        const anonymizedEmail = `deleted_${Date.now()}_${user.email}`;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'DELETED',
            permitirAcesso: false,
            email: anonymizedEmail,
          }
        });
        console.log(`Usuário arquivado via Soft Delete: ${user.name}`);
      } else {
        console.error(`Erro ao excluir ${user.name}:`, e);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
