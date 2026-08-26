'use server';

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/permissions";
import { salesService } from "../sales-service";

export async function getSaleInventoryMovementsAction(saleId: string) {
  try {
    const auth = await requirePermission("VENDAS", "VIEW");
    const sale = await salesService.getSaleById(saleId, auth.companyId);
    if (!sale) return { success: false, error: "Venda não encontrada." };
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        variant: { companyId: auth.companyId },
        OR: [
          { reason: `Venda #${sale.id}` },
          { reason: { startsWith: `Cancelamento da Venda #${sale.id}:` } },
        ],
      },
      include: { variant: true }
    });
    return { success: true, movements };
  } catch {
    return { success: false, error: "Não foi possível consultar as movimentações." };
  }
}
