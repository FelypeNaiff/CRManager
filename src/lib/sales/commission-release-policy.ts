import { Prisma, type CommissionReleasePolicy } from '@prisma/client';

export type ReceivableSettlement = {
  originalAmount: Prisma.Decimal.Value;
  paidAmount: Prisma.Decimal.Value;
  status: string;
};

/**
 * Pure contract for Sprint J. It does not persist releases or perform payments.
 * Callers must supply receivables reliably linked to the commission's sale.
 */
export function calculateReleasedCommission(
  policy: CommissionReleasePolicy,
  commissionAmount: Prisma.Decimal.Value,
  receivables: ReceivableSettlement[],
) {
  const commission = new Prisma.Decimal(commissionAmount);
  if (policy === 'ON_FINANCIAL_OBLIGATION') return commission;
  if (receivables.length === 0) return new Prisma.Decimal(0);

  const amounts = receivables.map(item => ({
    original: new Prisma.Decimal(item.originalAmount),
    paid: Prisma.Decimal.min(new Prisma.Decimal(item.paidAmount), new Prisma.Decimal(item.originalAmount)),
    settled: item.status === 'PAID' && new Prisma.Decimal(item.paidAmount).gte(item.originalAmount),
  }));

  if (policy === 'ON_FIRST_INSTALLMENT_RECEIVED') {
    return amounts.some(item => item.paid.gt(0)) ? commission : new Prisma.Decimal(0);
  }
  if (policy === 'ON_FULL_SETTLEMENT') {
    return amounts.every(item => item.settled) ? commission : new Prisma.Decimal(0);
  }

  const originalTotal = amounts.reduce((sum, item) => sum.plus(item.original), new Prisma.Decimal(0));
  if (originalTotal.lte(0)) return new Prisma.Decimal(0);
  const paidTotal = amounts.reduce((sum, item) => sum.plus(item.paid), new Prisma.Decimal(0));
  return Prisma.Decimal.min(commission, commission.mul(paidTotal).div(originalTotal).toDecimalPlaces(2));
}

