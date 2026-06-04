const fs = require('fs');

let pageContent = fs.readFileSync('src/app/(dashboard)/crm/historico/page.tsx', 'utf8');

pageContent = pageContent.replace(
  'import { getActivityLogs } from "@/lib/crm/actions"',
  'import { getCustomerHistoryLogs } from "@/lib/crm/actions"'
);

pageContent = pageContent.replace(
  'const res = await getActivityLogs()',
  'const res = await getCustomerHistoryLogs()'
);

pageContent = pageContent.replace(
  /const mapped = res\.data\.map\(\(l: any\) => \(\{[^]*?\}\)\)/,
  `const mapped = res.data.map((l: any) => ({
          usuario_nome: l.customer?.name || "Sistema",
          acao: l.actionType,
          modulo: "CRM",
          detalhes: l.description,
          registro_id: l.id || "",
          data_hora: { seconds: new Date(l.createdAt).getTime() / 1000 }
        }))`
);

fs.writeFileSync('src/app/(dashboard)/crm/historico/page.tsx', pageContent, 'utf8');

let actionsContent = fs.readFileSync('src/lib/crm/actions.ts', 'utf8');

const newFunc = `
export async function getCustomerHistoryLogs() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerHistory.findMany({
      where: { customer: { companyId: session.companyId } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error fetching customer history logs:', error);
    return { success: false, error: 'Erro ao buscar histórico.' };
  }
}
`;

actionsContent += "\\n" + newFunc;
fs.writeFileSync('src/lib/crm/actions.ts', actionsContent, 'utf8');
