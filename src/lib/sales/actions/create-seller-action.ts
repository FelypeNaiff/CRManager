'use server';
import { serializePrisma } from '@/lib/serialize';

import { PrismaClient } from "@prisma/client";
import { CreateSellerInput, createSellerSchema } from "../seller-schemas";

const prisma = new PrismaClient();

export async function createSellerAction(data: CreateSellerInput) {
  try {
    const validated = createSellerSchema.parse(data);
    const user = await prisma.user.update({
      where: { id: validated.userId },
      data: {
        isSeller: validated.isSeller,
        sellerCode: validated.sellerCode,
        commissionRate: validated.commissionRate,
        maxDiscountPercentage: validated.maxDiscountPercentage
      }
    });
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
