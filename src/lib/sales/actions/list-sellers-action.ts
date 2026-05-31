"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listSellersAction(companyId: string) {
  try {
    const sellers = await prisma.user.findMany({
      where: { companyId, isSeller: true }
    });
    return { success: true, sellers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
