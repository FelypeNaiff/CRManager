'use server';

import { prisma } from "@/lib/prisma";

export async function getSaleInventoryMovementsAction(saleId: string) {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        reason: { contains: saleId }
      },
      include: { variant: true }
    });
    return { success: true, movements };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
