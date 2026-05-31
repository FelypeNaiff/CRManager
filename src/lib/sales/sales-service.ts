import { PrismaClient } from "@prisma/client";
import { CreateSaleInput, CancelSaleInput } from "./sales-schemas";
import { sellerCommissionService } from "./seller-commission-service";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export class SalesService {
  async createSale(data: CreateSaleInput) {
    return prisma.$transaction(async (tx) => {
      // Etapa 1: Validar empresa, vendedor, cliente, caixa
      const company = await tx.company.findUnique({ where: { id: data.companyId } });
      if (!company) throw new Error("Empresa inválida.");

      const seller = await tx.user.findUnique({ where: { id: data.sellerId }, include: { role: true } });
      if (!seller || !seller.isSeller) throw new Error("Vendedor inválido.");

      if (data.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
        if (!customer) throw new Error("Cliente inválido.");
      }

      // Validar Caixa Aberto
      if (!data.cashRegisterId) {
        const activeRegister = await tx.cashRegister.findFirst({
          where: { companyId: data.companyId, openedByUserId: data.sellerId, status: "OPEN" }
        });
        if (!activeRegister) throw new Error("Nenhum caixa aberto encontrado. Abra o caixa para realizar vendas.");
        data.cashRegisterId = activeRegister.id;
      } else {
        const register = await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } });
        if (!register || register.status !== "OPEN") throw new Error("Caixa informado não está aberto.");
      }

      // Etapa 1.5: Validar Desconto (Fase 6F)
      let authorizedByUserId: string | null = null;
      let maxAllowed = 0;
      const discountPercentage = data.subtotal > 0 ? (data.discountAmount / data.subtotal) * 100 : 0;
      
      if (data.discountAmount > 0 && data.subtotal > 0) {
        if (seller.maxDiscountPercentage !== null) {
          maxAllowed = Number(seller.maxDiscountPercentage);
        } else if (seller.role?.maxDiscountPercentage !== null && seller.role?.maxDiscountPercentage !== undefined) {
          maxAllowed = Number(seller.role.maxDiscountPercentage);
        } else {
          maxAllowed = Number(company.maxDiscountPercentage);
        }

        if (discountPercentage > maxAllowed) {
          if (!data.authPin) {
            throw new Error(`Desconto solicitado (${discountPercentage.toFixed(2)}%) excede o limite permitido (${maxAllowed.toFixed(2)}%). Autorização de administrador é necessária.`);
          }

          // Authorize using PIN
          const possibleAdmins = await tx.user.findMany({
            where: { companyId: data.companyId, status: "ACTIVE", pinAccessHash: { not: "" } },
            include: { role: true }
          });

          let authorizer = null;
          for (const admin of possibleAdmins) {
            if (!admin.pinAccessHash) continue;
            const isValid = await bcrypt.compare(data.authPin, admin.pinAccessHash);
            if (isValid) {
              authorizer = admin;
              break;
            }
          }

          if (!authorizer) {
            throw new Error("PIN de autorização inválido ou usuário sem permissão.");
          }
          
          authorizedByUserId = authorizer.id;
        }
      }

      // Etapa 2: Validar estoque disponível
      for (const item of data.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant) throw new Error(`Variante ${item.variantId} não encontrada.`);

        if (!company.allowNegativeStockOnPDV && variant.availableStock.toNumber() < item.quantity) {
          throw new Error(`Estoque insuficiente para a variante ${variant.name}. Disponível: ${variant.availableStock.toNumber()}, Solicitado: ${item.quantity}`);
        }
      }

      // Etapa 3: Criar Sale e SaleItems e SalePayments
      const sale = await tx.sale.create({
        data: {
          companyId: data.companyId,
          sellerId: data.sellerId,
          customerId: data.customerId,
          cashRegisterId: data.cashRegisterId,
          status: "PAID",
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          totalAmount: data.totalAmount,
          notes: data.notes,
          customerNameSnapshot: data.customerNameSnapshot,
          customerPhoneSnapshot: data.customerPhoneSnapshot,
          items: {
            create: data.items.map(item => ({
              variantId: item.variantId,
              productNameSnapshot: item.productNameSnapshot,
              variantNameSnapshot: item.variantNameSnapshot,
              skuSnapshot: item.skuSnapshot,
              barcodeSnapshot: item.barcodeSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              totalPrice: item.totalPrice,
              costPriceAtSale: item.costPriceAtSale,
              salePriceAtSale: item.salePriceAtSale,
              marginAtSale: item.marginAtSale
            }))
          },
          payments: {
            create: data.payments.map(payment => ({
              paymentMethodId: payment.paymentMethodId,
              amount: payment.amount,
              installments: payment.installments,
              status: "PAID"
            }))
          }
        },
        include: { items: true, payments: true }
      });

      // Gravar Autorização se houver
      if (authorizedByUserId) {
        await tx.saleAuthorization.create({
          data: {
            saleId: sale.id,
            requestedByUserId: data.sellerId,
            authorizedByUserId: authorizedByUserId,
            type: "DISCOUNT_OVER_LIMIT",
            status: "APPROVED",
            reason: data.authReason || "Sem motivo informado",
            requestedDiscount: data.discountAmount,
            allowedDiscount: maxAllowed
          }
        });

        await tx.activityLog.create({
          data: {
            companyId: data.companyId,
            userId: authorizedByUserId,
            action: "AUTHORIZE_DISCOUNT",
            module: "SALES",
            recordId: sale.id,
            details: `Desconto de R$ ${data.discountAmount} (Lim: ${maxAllowed}%) aprovado na venda #${sale.id}`
          }
        });
      }

      // Etapa 4: Processar Pagamentos e Financeiro
      for (const payment of data.payments) {
        const pm = await tx.paymentMethod.findUnique({ where: { id: payment.paymentMethodId } });
        if (!pm) throw new Error("Método de pagamento inválido.");

        if (pm.type === "STORE_CREDIT") {
          // Crediário
          if (!data.customerId) throw new Error("Cliente obrigatório para crediário.");
          
          const finTx = await tx.financialTransaction.create({
            data: {
              companyId: data.companyId,
              type: "INCOME",
              direction: "IN",
              status: "PENDING",
              customerId: data.customerId,
              cashRegisterId: data.cashRegisterId,
              paymentMethodId: pm.id,
              referenceType: "SALE",
              referenceId: sale.id,
              sourceModule: "SALES",
              description: `Venda #${sale.id} - Crediário`,
              amount: payment.amount,
              createdByUserId: data.sellerId
            }
          });

          await tx.accountsReceivable.create({
            data: {
              companyId: data.companyId,
              customerId: data.customerId,
              financialTransactionId: finTx.id,
              totalInstallments: payment.installments || 1,
              installmentNumber: 1,
              originalAmount: payment.amount,
              remainingAmount: payment.amount,
              dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
              status: "PENDING"
            }
          });

        } else if (pm.type === "CUSTOMER_WALLET") {
          // Carteira Digital
          if (!data.customerId) throw new Error("Cliente obrigatório para usar carteira digital.");
          const wallet = await tx.customerWallet.findUnique({ where: { customerId: data.customerId } });
          if (!wallet || wallet.balance.toNumber() < payment.amount) {
            throw new Error(`Saldo insuficiente na carteira do cliente.`);
          }

          // Debitar da carteira
          await tx.customerWallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: payment.amount } }
          });

          await tx.customerWalletMovement.create({
            data: {
              walletId: wallet.id,
              amount: payment.amount,
              type: "OUT",
              reason: `Pagamento Venda #${sale.id}`
            }
          });

        } else {
          // CASH, PIX, CREDIT_CARD, DEBIT_CARD, etc
          const isCash = pm.type === "CASH";
          
          const finTx = await tx.financialTransaction.create({
            data: {
              companyId: data.companyId,
              type: "INCOME",
              direction: "IN",
              status: "PAID",
              customerId: data.customerId || undefined,
              cashRegisterId: data.cashRegisterId,
              paymentMethodId: pm.id,
              referenceType: "SALE",
              referenceId: sale.id,
              sourceModule: "SALES",
              description: `Venda #${sale.id} - ${pm.name}`,
              amount: payment.amount,
              paidAt: new Date(),
              createdByUserId: data.sellerId
            }
          });

          if (isCash) {
            await tx.cashMovement.create({
              data: {
                companyId: data.companyId,
                cashRegisterId: data.cashRegisterId!,
                type: "IN",
                amount: payment.amount,
                description: `Venda #${sale.id}`,
                createdByUserId: data.sellerId
              }
            });

            await tx.cashRegister.update({
              where: { id: data.cashRegisterId! },
              data: { expectedBalance: { increment: payment.amount } }
            });
          }
        }
      }

      // Etapa 5 & 6: Criar InventoryMovement tipo SALE e atualizar ProductVariant
      for (const item of data.items) {
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "SALE",
            userId: data.sellerId,
            reason: `Venda #${sale.id}`
          }
        });

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            currentStock: { decrement: item.quantity },
            availableStock: { decrement: item.quantity }
          }
        });
      }

      // Etapa 7: Criar ActivityLog
      await tx.activityLog.create({
        data: {
          companyId: data.companyId,
          userId: data.sellerId,
          action: "CREATE_SALE",
          module: "SALES",
          recordId: sale.id,
          details: `Venda criada. Valor Total: ${data.totalAmount}`
        }
      });

      // Etapa 8: Integrar comissões e metas
      await sellerCommissionService.processSaleCommission(tx, sale);

      return sale;
    });
  }

  async cancelSale(data: CancelSaleInput) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ 
        where: { id: data.saleId },
        include: { items: true } 
      });
      if (!sale) throw new Error("Venda não encontrada.");
      if (sale.status === "CANCELLED") throw new Error("Venda já está cancelada.");

      // Marcar Sale como CANCELLED e preencher motivos
      const cancelledSale = await tx.sale.update({
        where: { id: data.saleId },
        data: {
          status: "CANCELLED",
          cancelReason: data.cancelReason,
          cancelledByUserId: data.cancelledByUserId,
          cancelledAt: new Date()
        }
      });

      // Criar InventoryMovement tipo CANCELLATION e devolver estoque
      for (const item of sale.items) {
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "CANCELLATION",
            userId: data.cancelledByUserId,
            reason: `Cancelamento da Venda #${sale.id}: ${data.cancelReason}`
          }
        });

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            currentStock: { increment: item.quantity },
            availableStock: { increment: item.quantity }
          }
        });
      }

      // Criar ActivityLog
      await tx.activityLog.create({
        data: {
          companyId: sale.companyId,
          userId: data.cancelledByUserId,
          action: "CANCEL_SALE",
          module: "SALES",
          recordId: sale.id,
          details: `Venda cancelada. Motivo: ${data.cancelReason}`
        }
      });

      // Estornar comissões e metas
      await sellerCommissionService.rollbackSaleCommission(tx, sale);

      return cancelledSale;
    });
  }

  async getSaleById(saleId: string) {
    return prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        authorizations: true,
        commissions: true,
        customer: true,
        seller: true
      }
    });
  }

  async listSales(companyId: string, filters?: {
    sellerId?: string;
    customerId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const whereClause: any = { companyId };
    
    if (filters?.sellerId) whereClause.sellerId = filters.sellerId;
    if (filters?.customerId) whereClause.customerId = filters.customerId;
    if (filters?.status) whereClause.status = filters.status;
    
    if (filters?.startDate || filters?.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) whereClause.createdAt.gte = filters.startDate;
      if (filters.endDate) whereClause.createdAt.lte = filters.endDate;
    }

    return prisma.sale.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        payments: true,
        seller: true,
        customer: true
      }
    });
  }
}

export const salesService = new SalesService();
