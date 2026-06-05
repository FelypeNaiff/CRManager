'use server';
import { serializePrisma } from '@/lib/serialize';

import { PrismaClient } from "@prisma/client";
import { CreateSellerGoalInput, createSellerGoalSchema } from "../seller-schemas";

const prisma = new PrismaClient();

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
