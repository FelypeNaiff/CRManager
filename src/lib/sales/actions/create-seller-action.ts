'use server';

import { prisma } from "@/lib/prisma";
import { CreateSellerInput, createSellerSchema } from "../seller-schemas";

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
