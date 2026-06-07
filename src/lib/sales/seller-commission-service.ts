import { prisma } from "@/lib/prisma";
import { OperationalSettingsService } from "../configuracoes/operational-settings-service";

export class SellerCommissionService {
  async processSaleCommission(tx: any, sale: any) {
    // Busca o vendedor na tabela Seller
    const seller = await tx.seller.findUnique({
      where: { id: sale.sellerId }
    });
    if (!seller || seller.status !== 'ACTIVE') return;

    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(sale.companyId, tx);

    // Se empresa habilita metas e há metas ativas, soma
    if (settings.enableSellerGoals) {
      const now = new Date();
      const activeGoals = await tx.sellerGoal.findMany({
        where: {
          sellerId: seller.id,
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
      if (seller.commissionRate && Number(seller.commissionRate) > 0) {
        rate = Number(seller.commissionRate);
      } else if (settings.defaultCommissionRate && Number(settings.defaultCommissionRate) > 0) {
        rate = Number(settings.defaultCommissionRate);
      }

      if (rate > 0) {
        const commissionAmount = Number(sale.totalAmount) * (rate / 100);
        await tx.sellerCommission.create({
          data: {
            sellerId: seller.id,
            saleId: sale.id,
            amount: commissionAmount,
            status: "PENDING"
          }
        });
      }
    }
  }

  async rollbackSaleCommission(tx: any, sale: any) {
    const seller = await tx.seller.findUnique({
      where: { id: sale.sellerId }
    });
    if (!seller || seller.status !== 'ACTIVE') return;

    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(sale.companyId, tx);

    if (settings.enableSellerGoals) {
      const now = new Date(sale.createdAt); // Data original da venda
      const activeGoals = await tx.sellerGoal.findMany({
        where: {
          sellerId: seller.id,
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
