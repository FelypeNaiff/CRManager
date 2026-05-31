import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class SalesRepository {
  async createSale(data: any) {
    return prisma.sale.create({ data });
  }

  async getSaleById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        authorizations: true
      }
    });
  }

  async updateSaleStatus(id: string, status: any) {
    return prisma.sale.update({
      where: { id },
      data: { status }
    });
  }

  async cancelSale(id: string, data: any) {
    return prisma.sale.update({
      where: { id },
      data
    });
  }
}

export const salesRepository = new SalesRepository();
