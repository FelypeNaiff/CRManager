"use server";

import { PrismaClient } from "@prisma/client";
import { UpdateSellerInput, updateSellerSchema } from "../seller-schemas";

const prisma = new PrismaClient();

export async function updateSellerAction(data: UpdateSellerInput) {
  try {
    const validated = updateSellerSchema.parse(data);
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
