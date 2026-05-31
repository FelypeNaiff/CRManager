"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function searchVariantsAction(companyId: string, query: string) {
  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        product: { companyId },
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
          { barcode: { contains: query, mode: "insensitive" } },
          { product: { name: { contains: query, mode: "insensitive" } } }
        ]
      },
      include: { product: true },
      take: 20
    });
    return { success: true, variants };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function searchCustomersAction(companyId: string, query: string) {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } }
        ]
      },
      include: {
        wallet: true
      },
      take: 20
    });
    return { success: true, customers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
