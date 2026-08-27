import { prisma } from "@/lib/prisma";
import { CreateSellerInput, UpdateSellerInput } from "./sellers-schemas";
import { sellerTenantWhere } from './seller-security';

export class SellersService {
  constructor(private readonly db: Pick<typeof prisma, "seller" | "sale"> = prisma) {}
  async getSellersByCompany(companyId: string, status?: "ACTIVE" | "INACTIVE") {
    return this.db.seller.findMany({
      where: {
        companyId,
        ...(status ? { status } : {})
      },
      orderBy: { name: "asc" }
    });
  }

  async getSellerById(id: string, companyId: string) {
    return this.db.seller.findFirst({ where: sellerTenantWhere(id, companyId) });
  }

  async createSeller(data: CreateSellerInput, companyId: string) {
    return this.db.seller.create({
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
    const existing = await this.db.seller.findFirst({ where: sellerTenantWhere(id, companyId) });
    if (!existing) {
      throw new Error("Vendedor não encontrado ou sem permissão.");
    }

    return this.db.seller.update({
      where: sellerTenantWhere(id, companyId),
      data: {
        ...rest,
        email: rest.email === "" ? null : rest.email
      }
    });
  }

  async deleteSeller(id: string, companyId: string) {
    const existing = await this.db.seller.findFirst({ where: sellerTenantWhere(id, companyId) });
    if (!existing) {
      throw new Error("Vendedor não encontrado ou sem permissão.");
    }
    
    // Instead of deleting, just set to INACTIVE so sales history isn't lost
    // Or if we need hard delete, we check if sales exist
    const salesCount = await this.db.sale.count({ where: { sellerId: id, companyId } });
    if (salesCount > 0) {
      // Soft delete
      return this.db.seller.update({
        where: sellerTenantWhere(id, companyId),
        data: { status: "INACTIVE" }
      });
    }

    return this.db.seller.delete({ where: sellerTenantWhere(id, companyId) });
  }
}

export const sellersService = new SellersService();
