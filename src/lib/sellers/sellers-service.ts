import { prisma } from "@/lib/prisma";
import { CreateSellerInput, UpdateSellerInput } from "./sellers-schemas";

export class SellersService {
  async getSellersByCompany(companyId: string, status?: "ACTIVE" | "INACTIVE") {
    return prisma.seller.findMany({
      where: {
        companyId,
        ...(status ? { status } : {})
      },
      orderBy: { name: "asc" }
    });
  }

  async getSellerById(id: string, companyId: string) {
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller || seller.companyId !== companyId) return null;
    return seller;
  }

  async createSeller(data: CreateSellerInput, companyId: string) {
    return prisma.seller.create({
      data: {
        ...data,
        companyId,
        email: data.email || null, // handle empty string from form
      }
    });
  }

  async updateSeller(data: UpdateSellerInput, companyId: string) {
    const { id, ...rest } = data;
    
    // Validate ownership
    const existing = await prisma.seller.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new Error("Vendedor não encontrado ou sem permissão.");
    }

    return prisma.seller.update({
      where: { id },
      data: {
        ...rest,
        email: rest.email === "" ? null : rest.email
      }
    });
  }

  async deleteSeller(id: string, companyId: string) {
    const existing = await prisma.seller.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new Error("Vendedor não encontrado ou sem permissão.");
    }
    
    // Instead of deleting, just set to INACTIVE so sales history isn't lost
    // Or if we need hard delete, we check if sales exist
    const salesCount = await prisma.sale.count({ where: { sellerId: id } });
    if (salesCount > 0) {
      // Soft delete
      return prisma.seller.update({
        where: { id },
        data: { status: "INACTIVE" }
      });
    }

    return prisma.seller.delete({ where: { id } });
  }
}

export const sellersService = new SellersService();
