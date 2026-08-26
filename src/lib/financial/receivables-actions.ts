'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/permissions";
import { receivablesService } from "./receivables-service";
import { revalidatePath } from "next/cache";
import { scopeReceivablesList, secureReceivableSettlement } from './receivables-tenant-security';

export async function getAccountsReceivableAction(companyId: string, filters?: {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
}) {
  try {
    const auth = await requirePermission("FINANCEIRO", "VIEW");

    const whereClause: any = scopeReceivablesList(auth, undefined, companyId);

    if (filters?.status && filters.status !== "ALL") {
      whereClause.status = filters.status;
    }
    if (filters?.customerId && filters.customerId !== "ALL") {
      whereClause.customerId = filters.customerId;
    }
    if (filters?.startDate || filters?.endDate) {
      whereClause.dueDate = {};
      if (filters.startDate) whereClause.dueDate.gte = filters.startDate;
      if (filters.endDate) whereClause.dueDate.lte = filters.endDate;
    }

    const receivables = await prisma.accountsReceivable.findMany({
      where: whereClause,
      include: {
        customer: true,
        financialTransaction: {
          include: {
            paymentMethod: true
          }
        }
      },
      orderBy: { dueDate: "asc" }
    });

    return { success: true, receivables };
  } catch {
    return { success: false, error: 'Erro ao consultar contas a receber.' };
  }
}

export async function settleReceivableAction(receivableId: string) {
  try {
    const session = await requirePermission("FINANCEIRO", "UPDATE");
    const settlement = secureReceivableSettlement(session, receivableId);

    await prisma.$transaction(async (tx: any) => {
      await receivablesService.settleReceivable(
        settlement.receivableId,
        new Date(),
        settlement.userId,
        settlement.companyId,
        tx,
      );
      
      // Activity Log
      const rec = await tx.accountsReceivable.findFirst({
        where: { id: settlement.receivableId, companyId: settlement.companyId },
      });
      if (rec) {
        await tx.activityLog.create({
          data: {
            companyId: settlement.companyId,
            userId: settlement.userId,
            action: "SETTLE_RECEIVABLE",
            module: "FINANCEIRO",
            recordId: receivableId,
            details: `Baixa manual do título ${receivableId} no valor de ${rec.originalAmount}`
          }
        });
      }
    });

    revalidatePath("/financeiro/recebimentos");
    return { success: true };
  } catch {
    return { success: false, error: 'Não foi possível realizar a baixa do recebível.' };
  }
}
