'use server';

import { prisma } from "@/lib/prisma";
import { CreateSellerGoalInput, createSellerGoalSchema } from "../seller-schemas";

export async function createSellerGoalAction(data: CreateSellerGoalInput) {
  try {
    const validated = createSellerGoalSchema.parse(data);
    const goal = await prisma.sellerGoal.create({
      data: {
        userId: validated.userId,
        periodStart: validated.periodStart,
        periodEnd: validated.periodEnd,
        targetAmount: validated.targetAmount,
        achievedAmount: 0
      }
    });
    return { success: true, goal };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
