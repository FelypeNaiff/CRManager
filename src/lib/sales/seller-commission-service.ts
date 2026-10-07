import { Prisma, type CommissionReleasePolicy } from "@prisma/client";
import { OperationalSettingsService } from "../configuracoes/operational-settings-service";

export class SellerCommissionService {
  constructor(
    private readonly getSettings: typeof OperationalSettingsService.getOrCreateOperationalSettings =
      OperationalSettingsService.getOrCreateOperationalSettings,
  ) {}

  async processSaleCommission(tx: any, sale: any) {
    // Busca o vendedor na tabela Seller
    const seller = await tx.seller.findFirst({
      where: { id: sale.sellerId, companyId: sale.companyId }
    });
    if (!seller || seller.status !== 'ACTIVE') return;

    const settings = await this.getSettings(sale.companyId, tx);

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
      let rate = new Prisma.Decimal(0);
      if (seller.commissionRate && Number(seller.commissionRate) > 0) {
        rate = new Prisma.Decimal(seller.commissionRate);
      } else if (settings.defaultCommissionRate && Number(settings.defaultCommissionRate) > 0) {
        rate = new Prisma.Decimal(settings.defaultCommissionRate);
      }

      const itemSnapshots = Array.isArray(sale.items) ? sale.items : [];
      const hasItemSnapshots = itemSnapshots.length > 0 && itemSnapshots.every((item: any) => item.commissionAmountSnapshot !== null && item.commissionAmountSnapshot !== undefined);
      const baseAmount = hasItemSnapshots
        ? itemSnapshots.reduce((sum: Prisma.Decimal, item: any) => sum.plus(item.commissionBaseSnapshot), new Prisma.Decimal(0))
        : new Prisma.Decimal(sale.totalAmount);
      const commissionAmount = hasItemSnapshots
        ? itemSnapshots.reduce((sum: Prisma.Decimal, item: any) => sum.plus(item.commissionAmountSnapshot), new Prisma.Decimal(0)).toDecimalPlaces(2)
        : baseAmount.mul(rate).div(100).toDecimalPlaces(2);

      if (commissionAmount.gt(0)) {
        const releasePolicy = (seller.commissionReleasePolicy
          ?? settings.commissionReleasePolicy
          ?? 'ON_FINANCIAL_OBLIGATION') as CommissionReleasePolicy;
        const releasedAt = releasePolicy === 'ON_FINANCIAL_OBLIGATION' ? new Date() : null;
        await tx.sellerCommission.create({
          data: {
            sellerId: seller.id,
            saleId: sale.id,
            amount: commissionAmount,
            status: "PENDING",
            baseAmountSnapshot: baseAmount,
            rateSnapshot: hasItemSnapshots ? null : rate,
            releasePolicySnapshot: releasePolicy,
            releasedAmount: releasedAt ? commissionAmount : new Prisma.Decimal(0),
            releasedAt,
          }
        });
      }
    }
  }

  async rollbackSaleCommission(tx: any, sale: any) {
    const seller = await tx.seller.findFirst({
      where: { id: sale.sellerId, companyId: sale.companyId }
    });
    if (!seller) return;

    const settings = await this.getSettings(sale.companyId, tx);

    const commissions = settings.enableCommissions
      ? await tx.sellerCommission.findMany({
          where: { saleId: sale.id, sellerId: seller.id }
        })
      : [];

    // A comissão cancelada funciona como marcador persistente do rollback desta venda.
    if (commissions.length > 0 && commissions.every((commission: any) => commission.status === "CANCELLED")) {
      return;
    }

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
        const decremented = await tx.sellerGoal.updateMany({
          where: { id: goal.id, achievedAmount: { gte: sale.totalAmount } },
          data: { achievedAmount: { decrement: sale.totalAmount } }
        });
        if (decremented.count === 0) {
          await tx.sellerGoal.updateMany({
            where: { id: goal.id, achievedAmount: { gt: 0 } },
            data: { achievedAmount: 0 }
          });
        }
      }
    }

    if (settings.enableCommissions) {
      for (const commission of commissions.filter((item: any) => item.status !== "CANCELLED")) {
        await tx.sellerCommission.update({
          where: { id: commission.id },
          data: { status: "CANCELLED" }
        });
      }
    }
  }
}

export const sellerCommissionService = new SellerCommissionService();
