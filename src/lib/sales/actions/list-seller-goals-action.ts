'use server';

import { prisma } from "@/lib/prisma";

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
