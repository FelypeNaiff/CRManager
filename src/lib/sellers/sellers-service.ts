import { prisma } from "@/lib/prisma";
import { CreateSellerInput, UpdateSellerInput } from "./sellers-schemas";
import { sellerTenantWhere } from './seller-security';

export class SellersService {
  constructor(private readonly db: Pick<typeof prisma, "seller" | "sale" | "user"> = prisma) {}

  private normalizeCpf(cpf?: string | null) {
    return cpf ? cpf.replace(/\D/g, "") : null;
  }

  private async validateRelationsAndDuplicates(data: CreateSellerInput | UpdateSellerInput, companyId: string, excludeId?: string) {
    const cpf = this.normalizeCpf(data.cpf);
    if (cpf) {
      const duplicate = await this.db.seller.findFirst({
        where: { companyId, cpf, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      if (duplicate) throw new Error("Já existe um funcionário com este CPF nesta empresa.");
    }
    if (data.userId) {
      const [user, linked] = await Promise.all([
        this.db.user.findFirst({ where: { id: data.userId, companyId }, select: { id: true } }),
        this.db.seller.findFirst({
          where: { companyId, userId: data.userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
          select: { id: true },
        }),
      ]);
      if (!user) throw new Error("Usuário não encontrado nesta empresa.");
      if (linked) throw new Error("Este usuário já está vinculado a outro funcionário.");
    }
    return cpf;
  }
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

  async getLinkableUsers(companyId: string) {
    return this.db.user.findMany({
      where: { companyId, status: "ACTIVE", permitirAcesso: true },
      select: { id: true, name: true, email: true, seller: { select: { id: true } } },
      orderBy: { name: "asc" },
    });
  }

  async createSeller(data: CreateSellerInput, companyId: string) {
    const cpf = await this.validateRelationsAndDuplicates(data, companyId);
    return this.db.seller.create({
      data: {
        ...data,
        companyId,
        cpf,
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

    const cpf = await this.validateRelationsAndDuplicates(data, companyId, id);

    return this.db.seller.update({
      where: sellerTenantWhere(id, companyId),
      data: {
        ...rest,
        ...(rest.cpf !== undefined ? { cpf } : {}),
        email: rest.email === "" ? null : rest.email
      }
    });
  }

  async deleteSeller(id: string, companyId: string) {
    const existing = await this.db.seller.findFirst({ where: sellerTenantWhere(id, companyId) });
    if (!existing) {
      throw new Error("Vendedor não encontrado ou sem permissão.");
    }
    
    // Funcionários nunca são excluídos pelo fluxo administrativo: metas,
    // vendas e comissões históricas devem permanecer consultáveis.
    return this.db.seller.update({
      where: sellerTenantWhere(id, companyId),
      data: { status: "INACTIVE" }
    });
  }
}

export const sellersService = new SellersService();
