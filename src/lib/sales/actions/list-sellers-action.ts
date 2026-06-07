'use server';

import { prisma } from "@/lib/prisma";

export async function listSellersAction(companyId: string) {
  try {
    const sellers = await prisma.seller.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { name: 'asc' }
    });
    return { success: true, sellers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
