'use server';

import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { tenantListWhere } from "../sales-tenant-security";

export async function listSellersAction(_companyId: string) {
  try {
    const auth = await requireAnyPermission([
      { module: "PDV", action: "VIEW" },
      { module: "VENDAS", action: "VIEW" },
    ]);
    const sellers = await prisma.seller.findMany({
      where: { ...tenantListWhere(auth.companyId), status: 'ACTIVE' },
      orderBy: { name: 'asc' }
    });
    return { success: true, sellers };
  } catch {
    return { success: false, error: "Não foi possível listar os vendedores." };
  }
}
