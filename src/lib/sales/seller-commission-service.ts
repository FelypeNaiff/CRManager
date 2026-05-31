import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class SellerCommissionService {
  async processSaleCommission(tx: any, sale: any) {
    // Busca configurações do usuário
    const seller = await tx.user.findUnique({
      where: { id: sale.sellerId },
      include: { company: true }
    });
    if (!seller || !seller.isSeller) return;

    const { company } = seller;

    // Se empresa habilita metas e há metas ativas, soma
    if (company.enableSellerGoals) {
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

    // Se empresa habilita comissões e vendedor tem taxa maior que 0, cria comissão
    if (company.enableSellerCommission && seller.commissionRate && seller.commissionRate.toNumber() > 0) {
      const commissionAmount = sale.totalAmount * (seller.commissionRate.toNumber() / 100);
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

  async rollbackSaleCommission(tx: any, sale: any) {
    const seller = await tx.user.findUnique({
      where: { id: sale.sellerId },
      include: { company: true }
    });
    if (!seller || !seller.isSeller) return;

    const { company } = seller;

    if (company.enableSellerGoals) {
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

    if (company.enableSellerCommission) {
      // Procura comissão atrelada
      const commissions = await tx.sellerCommission.findMany({
        where: { saleId: sale.id }
      });

      for (const commission of commissions) {
        if (commission.status === "PAID") {
          // Neste caso a comissão já foi paga, fluxo financeiro deveria abater futuramente,
          // mas vamos marcar como CANCELLED de qualquer forma para auditoria.
          await tx.sellerCommission.update({
            where: { id: commission.id },
            data: { status: "CANCELLED" }
          });
        } else {
          await tx.sellerCommission.update({
            where: { id: commission.id },
            data: { status: "CANCELLED" }
          });
        }
      }
    }
  }
}

export const sellerCommissionService = new SellerCommissionService();
