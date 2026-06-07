import { prisma } from "@/lib/prisma";
import { 
  AccountReceivableStatus, 
  FinancialTransactionStatus, 
  FinancialTransactionType,
  PaymentMethodType,
  Prisma,
  Sale,
  SalePayment,
  PaymentMethod
} from "@prisma/client";

export class ReceivablesService {
  /**
   * Processa os pagamentos de uma venda e gera os títulos a receber, transações de caixa ou débitos de carteira.
   */
  async generateReceivablesFromSale(saleId: string, tx: Prisma.TransactionClient) {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        payments: {
          include: { paymentMethod: true }
        },
        company: true
      }
    });

    if (!sale) throw new Error("Venda não encontrada para gerar recebíveis.");

    const now = new Date();

    for (const payment of sale.payments) {
      const pm = payment.paymentMethod;
      const amount = payment.amount;

      // 1. Pagamento em Carteira do Cliente
      if (pm.type === PaymentMethodType.CUSTOMER_WALLET) {
        if (!sale.customerId) {
          throw new Error("Cliente não identificado para usar o saldo da carteira.");
        }
        
        // Pessimistic lock on the wallet (ordem: CashRegister -> CustomerWallet)
        await tx.$queryRawUnsafe(
          `SELECT id FROM customer_wallets WHERE customer_id = $1 FOR UPDATE`,
          sale.customerId
        );

        const wallet = await tx.customerWallet.findUnique({
          where: { customerId: sale.customerId }
        });

        if (!wallet || wallet.balance.lessThan(amount)) {
          throw new Error("Saldo insuficiente na carteira do cliente.");
        }

        // Desconta da carteira
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } }
        });

        // Gera WalletTransaction
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            customerId: sale.customerId,
            saleId: sale.id,
            type: "DEBIT",
            amount: amount,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance.minus(amount),
            description: `Uso de saldo na venda ${sale.id}`,
            createdById: sale.sellerId
          }
        });

        // Não gera AccountsReceivable
        continue;
      }

      // 2. Pagamento em Dinheiro
      if (pm.type === PaymentMethodType.CASH) {
        if (!sale.cashRegisterId) {
          throw new Error("Venda em dinheiro requer um caixa (CashRegister) aberto.");
        }

        // Atualiza saldo do Caixa Físico
        await tx.cashRegister.update({
          where: { id: sale.cashRegisterId },
          data: {
            expectedBalance: { increment: amount },
          }
        });

        // Cria CashMovement
        const cashMovement = await tx.cashMovement.create({
          data: {
            companyId: sale.companyId,
            cashRegisterId: sale.cashRegisterId,
            type: "IN",
            amount: amount,
            description: `Recebimento em dinheiro - Venda ${sale.id}`,
            createdByUserId: sale.sellerId
          }
        });

        // Cria FinancialTransaction diretamente, pois já entrou no caixa
        await tx.financialTransaction.create({
          data: {
            companyId: sale.companyId,
            type: FinancialTransactionType.INCOME,
            direction: "IN",
            status: FinancialTransactionStatus.PAID,
            cashRegisterId: sale.cashRegisterId,
            paymentMethodId: pm.id,
            customerId: sale.customerId,
            referenceType: "SALE",
            referenceId: sale.id,
            sourceModule: "PDV",
            description: `Venda ${sale.id} - Dinheiro`,
            amount: amount,
            paidAt: now,
            createdByUserId: sale.sellerId
          }
        });

        continue;
      }

      // 3. PIX ou Débito com liquidação imediata (settlementDays = 0)
      if ((pm.settlementDays === 0 && (payment.installments || 1) <= 1) || pm.type === PaymentMethodType.PIX) {
        // Criar a transação financeira (Income)
        const finTx = await tx.financialTransaction.create({
          data: {
            companyId: sale.companyId,
            type: FinancialTransactionType.INCOME,
            direction: "IN",
            status: FinancialTransactionStatus.PAID,
            cashRegisterId: sale.cashRegisterId, // Pode estar vinculado ao turno ou banco
            paymentMethodId: pm.id,
            customerId: sale.customerId,
            referenceType: "SALE",
            referenceId: sale.id,
            sourceModule: "PDV",
            description: `Venda ${sale.id} - ${pm.name}`,
            amount: amount,
            dueDate: now,
            paidAt: now,
            createdByUserId: sale.sellerId
          }
        });

        // Criar recebível já pago
        await tx.accountsReceivable.create({
          data: {
            companyId: sale.companyId,
            customerId: sale.customerId,
            financialTransactionId: finTx.id,
            installmentNumber: 1,
            totalInstallments: 1,
            originalAmount: amount,
            paidAmount: amount,
            remainingAmount: 0,
            dueDate: now,
            paidAt: now,
            status: AccountReceivableStatus.PAID,
            notes: `Recebimento imediato - ${pm.name}`
          }
        });

        // Taxa do PIX/Débito (Se houver)
        if (pm.feePercentage.greaterThan(0)) {
          const feeAmount = new Prisma.Decimal(amount.toNumber() * (pm.feePercentage.toNumber() / 100));
          await tx.financialTransaction.create({
            data: {
              companyId: sale.companyId,
              type: FinancialTransactionType.EXPENSE,
              direction: "OUT",
              status: FinancialTransactionStatus.PAID,
              paymentMethodId: pm.id,
              referenceType: "SALE_FEE",
              referenceId: finTx.id,
              sourceModule: "PDV",
              description: `Taxa de Cartão/PIX - Venda ${sale.id}`,
              amount: feeAmount,
              paidAt: now,
              createdByUserId: sale.sellerId
            }
          });
        }

        continue;
      }

      // 4. Cartão de Crédito e Crediário (A Prazo / Parcelado)
      // Dividimos o amount pelo número de parcelas
      const installments = payment.installments > 0 ? payment.installments : 1;
      const installmentAmount = new Prisma.Decimal(amount.toNumber() / installments);

      for (let i = 1; i <= installments; i++) {
        // Calcular vencimento (D + (settlementDays * i) ou mensal para crediário)
        // Simplificação: 30 dias por parcela
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + (pm.settlementDays > 0 ? pm.settlementDays * i : 30 * i));

        const finTx = await tx.financialTransaction.create({
          data: {
            companyId: sale.companyId,
            type: FinancialTransactionType.INCOME,
            direction: "IN",
            status: FinancialTransactionStatus.PENDING,
            paymentMethodId: pm.id,
            customerId: sale.customerId,
            referenceType: "SALE",
            referenceId: sale.id,
            sourceModule: "PDV",
            description: `Venda ${sale.id} - ${pm.name} - Parcela ${i}/${installments}`,
            amount: installmentAmount,
            dueDate: dueDate,
            createdByUserId: sale.sellerId
          }
        });

        await tx.accountsReceivable.create({
          data: {
            companyId: sale.companyId,
            customerId: sale.customerId,
            financialTransactionId: finTx.id,
            installmentNumber: i,
            totalInstallments: installments,
            originalAmount: installmentAmount,
            paidAmount: 0,
            remainingAmount: installmentAmount,
            dueDate: dueDate,
            status: AccountReceivableStatus.PENDING,
            notes: `Venda a prazo - ${pm.name}`
          }
        });
      }
    }
  }

  /**
   * Realiza a baixa manual de um Contas a Receber, processando taxas.
   */
  async settleReceivable(receivableId: string, settleDate: Date, userId: string, tx: Prisma.TransactionClient) {
    const receivable = await tx.accountsReceivable.findUnique({
      where: { id: receivableId },
      include: {
        financialTransaction: {
          include: { paymentMethod: true }
        }
      }
    });

    if (!receivable) throw new Error("Recebível não encontrado.");
    if (receivable.status === AccountReceivableStatus.PAID) throw new Error("Recebível já foi liquidado.");

    const finTx = receivable.financialTransaction;
    if (!finTx) throw new Error("Recebível não possui transação financeira atrelada.");

    const amount = receivable.originalAmount;

    // Atualiza Recebível
    await tx.accountsReceivable.update({
      where: { id: receivableId },
      data: {
        paidAmount: amount,
        remainingAmount: 0,
        paidAt: settleDate,
        status: AccountReceivableStatus.PAID
      }
    });

    // Atualiza a Transação Principal (Entrada do Valor Bruto)
    await tx.financialTransaction.update({
      where: { id: finTx.id },
      data: {
        status: FinancialTransactionStatus.PAID,
        paidAt: settleDate
      }
    });

    // Calcula e Gera Despesa da Taxa (Valor Líquido = Bruto - Taxa)
    const pm = finTx.paymentMethod;
    if (pm && pm.feePercentage && pm.feePercentage.greaterThan(0)) {
      const feeAmount = new Prisma.Decimal(amount.toNumber() * (pm.feePercentage.toNumber() / 100));
      await tx.financialTransaction.create({
        data: {
          companyId: receivable.companyId,
          type: FinancialTransactionType.EXPENSE,
          direction: "OUT",
          status: FinancialTransactionStatus.PAID,
          paymentMethodId: pm.id,
          referenceType: "RECEIVABLE_FEE",
          referenceId: receivable.id,
          sourceModule: "FINANCEIRO",
          description: `Taxa Administrativa (${pm.name}) - Título ${receivable.id}`,
          amount: feeAmount,
          paidAt: settleDate,
          createdByUserId: userId
        }
      });
    }

    return receivable;
  }

  /**
   * Reverte os recebíveis e pagamentos em caso de cancelamento da venda.
   * - PENDING -> CANCELLED
   * - CASH -> Devolve ao CashRegister e estorna CashMovement
   * - WALLET -> Devolve saldo para a CustomerWallet
   */
  async cancelReceivablesFromSale(saleId: string, cancelledByUserId: string, tx: Prisma.TransactionClient) {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        payments: {
          include: { paymentMethod: true }
        }
      }
    });

    if (!sale) throw new Error("Venda não encontrada para cancelamento de recebíveis.");

    const now = new Date();

    // 1. Cancelar todas as FinancialTransactions ligadas à Sale
    await tx.financialTransaction.updateMany({
      where: { referenceType: "SALE", referenceId: saleId, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" }
    });

    // 2. Cancelar as FinancialTransactions das taxas, se houver, baseadas nos recebíveis.
    // Primeiro pegar os finTxs cancelados:
    const finTxs = await tx.financialTransaction.findMany({
      where: { referenceType: "SALE", referenceId: saleId }
    });
    const finTxIds = finTxs.map(f => f.id);

    await tx.financialTransaction.updateMany({
      where: { referenceType: "SALE_FEE", referenceId: { in: finTxIds } },
      data: { status: "CANCELLED" }
    });

    // 3. Cancelar todos os AccountsReceivable atrelados a esses finTxs que estão PENDING
    await tx.accountsReceivable.updateMany({
      where: { financialTransactionId: { in: finTxIds }, status: "PENDING" },
      data: { status: "CANCELLED" }
    });

    // 4. Se havia recebível já PAID (ex: Pix instantâneo), devemos estornar (Refund)
    // O sistema registra o cancelamento, mas não exclui fisicamente para histórico.
    // Recebíveis PAID ficarão como CANCELLED, marcando que o valor foi "estornado".
    await tx.accountsReceivable.updateMany({
      where: { financialTransactionId: { in: finTxIds }, status: "PAID" },
      data: { status: "CANCELLED", notes: "Estornado por cancelamento da Venda" }
    });

    // 5. Reverter entradas de Dinheiro no Caixa
    for (const payment of sale.payments) {
      const pm = payment.paymentMethod;

      if (pm.type === PaymentMethodType.CASH) {
        if (!sale.cashRegisterId) continue;

        // Deduz saldo esperado do Caixa
        await tx.cashRegister.update({
          where: { id: sale.cashRegisterId },
          data: { expectedBalance: { decrement: payment.amount } }
        });

        // Cria CashMovement de saída/estorno
        await tx.cashMovement.create({
          data: {
            companyId: sale.companyId,
            cashRegisterId: sale.cashRegisterId,
            type: "OUT",
            amount: payment.amount,
            description: `Estorno - Cancelamento Venda ${sale.id}`,
            createdByUserId: cancelledByUserId
          }
        });
      }

      // 6. Reverter débitos na Carteira (Creditar de volta)
      if (pm.type === PaymentMethodType.CUSTOMER_WALLET) {
        if (!sale.customerId) continue;

        // Pessimistic lock on the wallet
        await tx.$queryRawUnsafe(
          `SELECT id FROM customer_wallets WHERE customer_id = $1 FOR UPDATE`,
          sale.customerId
        );

        const wallet = await tx.customerWallet.findUnique({
          where: { customerId: sale.customerId }
        });

        if (wallet) {
          await tx.customerWallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: payment.amount } }
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              customerId: sale.customerId,
              saleId: sale.id,
              type: "REFUND",
              amount: payment.amount,
              balanceBefore: wallet.balance,
              balanceAfter: wallet.balance.plus(payment.amount),
              description: `Estorno de saldo - Cancelamento Venda ${sale.id}`,
              createdById: cancelledByUserId
            }
          });
        }
      }
    }
  }
}

export const receivablesService = new ReceivablesService();
