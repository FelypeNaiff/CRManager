'use server';
import { serializePrisma } from '@/lib/serialize';

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function searchVariantsAction(companyId: string, query: string) {
  try {
    const q = query.trim();
    const variants = await prisma.productVariant.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { sku: { equals: q } },
          { barcode: { equals: q } },
          { name: { contains: q, mode: "insensitive" } },
          { product: { name: { contains: q, mode: "insensitive" } } },
          { product: { internalCode: { equals: q } } }
        ]
      },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        salePrice: true,
        availableStock: true,
        productId: true,
        product: { select: { name: true, imageUrl: true } }
      },
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
          { phone: { contains: query, mode: "insensitive" } },
          { cpf: { contains: query, mode: "insensitive" } }
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
