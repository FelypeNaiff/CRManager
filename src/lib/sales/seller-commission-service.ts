import { PrismaClient } from "@prisma/client";
import { OperationalSettingsService } from "../configuracoes/operational-settings-service";

const prisma = new PrismaClient();

export class SellerCommissionService {
  async processSaleCommission(tx: any, sale: any) {
    // Busca configurações do usuário
    const seller = await tx.user.findUnique({
      where: { id: sale.sellerId },
      include: { company: true }
    });
    if (!seller || !seller.isSeller) return;

    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(sale.companyId, tx);

    // Se empresa habilita metas e há metas ativas, soma
    if (settings.enableSellerGoals) {
      const now = new Date();
      const activeGoals = await tx.sellerGoal.findMany({
        where: {
          userId: seller.id,
          periodStart: { lte: now },
          periodEnd: { gte: now }
        }
      });
      
      for (const goal of activeGoals) {
        await tx.sellerGoal.update({
          where: { id: goal.id },
          data: { achievedAmount: { increment: sale.totalAmount } }
        });
      }
    }

    // Se empresa habilita comissões, calcula e cria
    if (settings.enableCommissions) {
      let rate = 0;
      if (seller.commissionRate && seller.commissionRate.toNumber() > 0) {
        rate = seller.commissionRate.toNumber();
      } else if (settings.defaultCommissionRate && settings.defaultCommissionRate.toNumber() > 0) {
        rate = settings.defaultCommissionRate.toNumber();
      }

      if (rate > 0) {
        const commissionAmount = sale.totalAmount * (rate / 100);
        await tx.sellerCommission.create({
          data: {
            userId: seller.id,
            saleId: sale.id,
            amount: commissionAmount,
            status: "PENDING"
          }
        });
      }
    }
  }

  async rollbackSaleCommission(tx: any, sale: any) {
    const seller = await tx.user.findUnique({
      where: { id: sale.sellerId },
      include: { company: true }
    });
    if (!seller || !seller.isSeller) return;

    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(sale.companyId, tx);

    if (settings.enableSellerGoals) {
      const now = new Date(sale.createdAt); // Data original da venda
      const activeGoals = await tx.sellerGoal.findMany({
        where: {
          userId: seller.id,
          periodStart: { lte: now },
          periodEnd: { gte: now }
        }
      });
      
      for (const goal of activeGoals) {
        await tx.sellerGoal.update({
          where: { id: goal.id },
          data: { achievedAmount: { decrement: sale.totalAmount } }
        });
      }
    }

    if (settings.enableCommissions) {
      // Procura comissão atrelada
      const commissions = await tx.sellerCommission.findMany({
        where: { saleId: sale.id }
      });

      for (const commission of commissions) {
        await tx.sellerCommission.update({
          where: { id: commission.id },
          data: { status: "CANCELLED" }
        });
      }
    }
  }
}

export const sellerCommissionService = new SellerCommissionService();
