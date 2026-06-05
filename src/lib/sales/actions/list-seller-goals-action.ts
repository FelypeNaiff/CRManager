'use server';
import { serializePrisma } from '@/lib/serialize';

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listSellerGoalsAction(userId: string) {
  try {
    const goals = await prisma.sellerGoal.findMany({
      where: { userId },
      orderBy: { periodStart: "desc" }
    });
    return { success: true, goals };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
