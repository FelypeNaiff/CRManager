'use server';

import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { tenantListWhere } from "../sales-tenant-security";

export async function listPaymentMethodsAction(_companyId: string) {
  try {
    const auth = await requireAnyPermission([
      { module: "PDV", action: "VIEW" },
      { module: "VENDAS", action: "VIEW" },
    ]);
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { ...tenantListWhere(auth.companyId), isActive: true },
      orderBy: { name: "asc" }
    });
    return { success: true, paymentMethods };
  } catch {
    return { success: false, error: "Não foi possível listar as formas de pagamento." };
  }
}
