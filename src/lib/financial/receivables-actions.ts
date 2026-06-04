"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/permissions";
import { receivablesService } from "./receivables-service";
import { revalidatePath } from "next/cache";

export async function getAccountsReceivableAction(companyId: string, filters?: {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
}) {
  try {
    await requirePermission("FINANCEIRO", "VIEW");

    const whereClause: any = { companyId };

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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function settleReceivableAction(receivableId: string) {
  try {
    const session = await requirePermission("FINANCEIRO", "UPDATE");

    await prisma.$transaction(async (tx: any) => {
      await receivablesService.settleReceivable(receivableId, new Date(), session.userId, tx);
      
      // Activity Log
      const rec = await tx.accountsReceivable.findUnique({ where: { id: receivableId } });
      if (rec) {
        await tx.activityLog.create({
          data: {
            companyId: rec.companyId,
            userId: session.userId,
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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
