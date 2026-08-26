import { prisma } from "@/lib/prisma";

export class SalesRepository {
  /** companyId must come from the trusted server auth context. */
  async createSale(data: any, companyId: string) {
    return prisma.sale.create({ data: { ...data, companyId } });
  }

  /** companyId must come from the trusted server auth context. */
  async getSaleById(id: string, companyId: string) {
    return prisma.sale.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        payments: true,
        authorizations: true
      }
    });
  }

  async updateSaleStatus(id: string, companyId: string, status: any) {
    return prisma.sale.update({
      where: { id, companyId },
      data: { status }
    });
  }

  async cancelSale(id: string, companyId: string, data: any) {
    return prisma.sale.update({
      where: { id, companyId },
      data
    });
  }
}

export const salesRepository = new SalesRepository();
