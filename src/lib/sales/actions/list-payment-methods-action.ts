"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listPaymentMethodsAction(companyId: string) {
  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" }
    });
    return { success: true, paymentMethods };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
