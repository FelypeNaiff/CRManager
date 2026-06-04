const fs = require('fs');

let content = fs.readFileSync('src/lib/crm/actions.ts', 'utf8');

// replace the getSegmentacoesData
const newFunction = `
export async function getSegmentationData() {
  const session = await requirePermission('CLIENTES', 'VIEW');
  try {
    const clients = await prisma.customer.findMany({
      where: { companyId: session.companyId, status: { not: 'arquivado' } },
      include: {
        children: true,
        tagRelations: { include: { tag: true } },
        wallet: true,
        sales: { select: { id: true, totalAmount: true, createdAt: true }, where: { status: { not: 'CANCELLED' } } }
      }
    });

    const tags = await prisma.customerTag.findMany({
      where: { companyId: session.companyId }
    });

    const stats: Record<string, any> = {};
    clients.forEach(c => {
      let total = 0;
      let count = 0;
      let last: Date | null = null;
      c.sales.forEach(s => {
        total += Number(s.totalAmount);
        count++;
        if (!last || s.createdAt > last) last = s.createdAt;
      });

      stats[c.id] = {
        totalComprado: total,
        ticketMedio: count > 0 ? total / count : 0,
        ultimaCompra: last,
        saldoDisponivel: Number(c.wallet?.balance || 0),
        filhos: c.children.map(ch => ({ ...ch, data_nascimento: ch.birthDate, tamanho_roupa: ch.clothingSize, tamanho_calcado: ch.shoeSize, sexo: ch.gender, nome: ch.name })),
        tags: c.tagRelations.map(tr => tr.tag.name)
      };
    });

    const mappedClients = clients.map(c => ({
      id: c.id,
      nome: c.name,
      whatsapp: c.phone,
      whatsapp_principal: c.phone,
      aceita_marketing: true,
      aceita_marketing_whatsapp: true,
      vip: false,
      data_nascimento: c.birthDay ? new Date(c.birthYear || new Date().getFullYear(), (c.birthMonth || 1) - 1, c.birthDay) : null,
    }));

    return { success: true, data: { clientes: mappedClients, stats, tags } };
  } catch (error: any) {
    console.error('Error fetching segmentation data:', error);
    return { success: false, error: 'Erro ao buscar dados para segmentação.' };
  }
}
`;

content += "\\n" + newFunction;

fs.writeFileSync('src/lib/crm/actions.ts', content, 'utf8');
