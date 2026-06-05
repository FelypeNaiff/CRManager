'use server';
import { serializePrisma } from '@/lib/serialize';

import { PrismaClient } from "@prisma/client";
import { UpdateSellerGoalInput, updateSellerGoalSchema } from "../seller-schemas";

const prisma = new PrismaClient();

export async function updateSellerGoalAction(data: UpdateSellerGoalInput) {
  try {
    const validated = updateSellerGoalSchema.parse(data);
    const goal = await prisma.sellerGoal.update({
      where: { id: validated.goalId },
      data: {
        targetAmount: validated.targetAmount
      }
    });
    return { success: true, goal };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
