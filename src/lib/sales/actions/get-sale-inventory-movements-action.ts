'use server';
import { serializePrisma } from '@/lib/serialize';

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
