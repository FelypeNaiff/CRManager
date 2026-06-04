const fs = require('fs');

let content = fs.readFileSync('src/lib/crm/actions.ts', 'utf8');

const funcs = `
export async function listCampaigns() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const list = await prisma.customerHistory.findMany({
      where: { customer: { companyId: session.companyId }, actionType: 'Campanha WhatsApp' },
      orderBy: { createdAt: 'desc' },
      include: { customer: true }
    });

    const campaignsMap = new Map<string, any>();
    
    list.forEach(h => {
      // Group by description prefix or time to simulate "campaigns"
      // Since we don't have a Campaign model, we group by description.
      // But actually we could just return history items if there is no Campaign model.
      // Wait, we don't have a Campaign model? Let's check.
    });

    return { success: true, data: list.map(h => ({ id: h.id, nome: h.actionType, cliente: h.customer.name, createdAt: h.createdAt, description: h.description })) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCampaignAction(data: any) {
  const session = await requirePermission('CLIENTES', 'UPDATE');
  try {
    const { clients, name, message, integration } = data;
    
    for (const clientId of clients) {
      await prisma.customerHistory.create({
        data: {
          customerId: clientId,
          actionType: 'Campanha WhatsApp',
          description: \`Disparo da campanha "\${name}" via \${integration}. Mensagem: "\${message}"\`
        }
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
`;

content += "\\n" + funcs;
fs.writeFileSync('src/lib/crm/actions.ts', content, 'utf8');
