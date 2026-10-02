const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'financial', 'receivables-service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Modifica a assinatura da função
content = content.replace(
  /async cancelReceivablesFromSale\([\s\S]*?tx: Prisma\.TransactionClient,\n\s*\) {/g,
  `async cancelReceivablesFromSale(
    saleId: string,
    cancelledByUserId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
    options?: { refundMethod?: 'ORIGINAL' | 'WALLET_CREDIT' }
  ) {`
);

// Modifica o fluxo de PAID receivables
content = content.replace(
  /\/\/ 4\. Se havia recebível já PAID[\s\S]*?data: \{ status: "CANCELLED", notes: "Estornado por cancelamento da Venda" \}\n\s*\}\);/g,
  `// 4. Tratamento de Recebíveis já PAID
    if (options?.refundMethod === 'WALLET_CREDIT') {
      const paidReceivables = await tx.accountsReceivable.findMany({
        where: { companyId, financialTransactionId: { in: finTxIds }, status: "PAID" }
      });
      let totalPaid = 0;
      for (const r of paidReceivables) { totalPaid += Number(r.paidAmount); }
      if (totalPaid > 0 && sale.customerId) {
        await tx.$queryRawUnsafe(\`SELECT id FROM customer_wallets WHERE customer_id = $1 FOR UPDATE\`, sale.customerId);
        let wallet = await tx.customerWallet.findUnique({ where: { customerId: sale.customerId } });
        if (!wallet) {
          wallet = await tx.customerWallet.create({ data: { customerId: sale.customerId, balance: 0 } });
        }
        await tx.customerWallet.update({ where: { id: wallet.id }, data: { balance: { increment: totalPaid } } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            customerId: sale.customerId,
            saleId: sale.id,
            type: "REFUND",
            amount: totalPaid,
            balanceBefore: wallet.balance,
            balanceAfter: Number(wallet.balance) + totalPaid,
            description: \`Crédito (Cancelamento) - Venda \${sale.id.slice(0,8)}\`,
            createdById: cancelledByUserId
          }
        });
        // Maintain PAID status so money is not "cancelled" in accounting
      }
    } else {
      await tx.accountsReceivable.updateMany({
        where: { companyId, financialTransactionId: { in: finTxIds }, status: "PAID" },
        data: { status: "CANCELLED", notes: "Estornado por cancelamento da Venda" }
      });
    }`
);

// Modifica o Cash out (CASH)
content = content.replace(
  /\/\/ Deduz saldo esperado do Caixa[\s\S]*?\}\);/g,
  `// Deduz saldo esperado do Caixa
        if (options?.refundMethod !== 'WALLET_CREDIT') {
          await tx.cashRegister.update({
            where: { id: sale.cashRegisterId, companyId: sale.companyId },
            data: { expectedBalance: { decrement: payment.amount } }
          });
        } else if (sale.customerId) {
          await tx.$queryRawUnsafe(\`SELECT id FROM customer_wallets WHERE customer_id = $1 FOR UPDATE\`, sale.customerId);
          let wallet = await tx.customerWallet.findUnique({ where: { customerId: sale.customerId } });
          if (!wallet) {
            wallet = await tx.customerWallet.create({ data: { customerId: sale.customerId, balance: 0 } });
          }
          await tx.customerWallet.update({ where: { id: wallet.id }, data: { balance: { increment: payment.amount } } });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              customerId: sale.customerId,
              saleId: sale.id,
              type: "REFUND",
              amount: payment.amount,
              balanceBefore: wallet.balance,
              balanceAfter: Number(wallet.balance) + Number(payment.amount),
              description: \`Crédito (Dinheiro retido) - Venda \${sale.id.slice(0,8)}\`,
              createdById: cancelledByUserId
            }
          });
        }`
);

// Modifica o CashMovement OUT (CASH)
content = content.replace(
  /\/\/ Cria CashMovement de saída\/estorno[\s\S]*?\}\);/g,
  `// Cria CashMovement de saída/estorno
        if (options?.refundMethod !== 'WALLET_CREDIT') {
          await tx.cashMovement.create({
            data: {
              companyId: sale.companyId,
              cashRegisterId: sale.cashRegisterId,
              type: "OUT",
              amount: payment.amount,
              description: \`Estorno - Cancelamento Venda \${sale.id}\`,
              createdByUserId: cancelledByUserId
            }
          });
        }`
);


fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched successfully");
