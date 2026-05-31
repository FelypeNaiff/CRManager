import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// =============================================================================
// PAYMENT METHOD SERVICE — Formas de Pagamento
// =============================================================================

export type DefaultPaymentMethodDef = {
  name: string;
  type: 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'STORE_CREDIT' | 'CHECK' | 'OTHER';
  allowsInstallments: boolean;
  autoReceive: boolean;
  requiresAuthorization: boolean;
  feePercentage: number;
  settlementDays: number;
};

export const SYSTEM_DEFAULT_PAYMENT_METHODS: DefaultPaymentMethodDef[] = [
  {
    name: 'Dinheiro',
    type: 'CASH',
    allowsInstallments: false,
    autoReceive: true,
    requiresAuthorization: false,
    feePercentage: 0,
    settlementDays: 0,
  },
  {
    name: 'PIX',
    type: 'PIX',
    allowsInstallments: false,
    autoReceive: true,
    requiresAuthorization: false,
    feePercentage: 0,
    settlementDays: 0,
  },
  {
    name: 'Cartão de Débito',
    type: 'DEBIT_CARD',
    allowsInstallments: false,
    autoReceive: false,
    requiresAuthorization: true,
    feePercentage: 1.5,
    settlementDays: 1,
  },
  {
    name: 'Cartão de Crédito',
    type: 'CREDIT_CARD',
    allowsInstallments: true,
    autoReceive: false,
    requiresAuthorization: true,
    feePercentage: 2.99,
    settlementDays: 30,
  },
  {
    name: 'Crediário',
    type: 'STORE_CREDIT',
    allowsInstallments: true,
    autoReceive: false,
    requiresAuthorization: false,
    feePercentage: 0,
    settlementDays: 30,
  },
  {
    name: 'Transferência Bancária',
    type: 'BANK_TRANSFER',
    allowsInstallments: false,
    autoReceive: false,
    requiresAuthorization: false,
    feePercentage: 0,
    settlementDays: 1,
  },
];

/**
 * Garante que as formas de pagamento padrão existem para uma empresa.
 * Idempotente: não duplica se já existirem.
 */
export async function ensureDefaultPaymentMethods(companyId: string): Promise<void> {
  for (const method of SYSTEM_DEFAULT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { companyId_name: { companyId, name: method.name } },
      update: {}, // Não atualiza se já existir
      create: {
        companyId,
        name: method.name,
        type: method.type,
        allowsInstallments: method.allowsInstallments,
        autoReceive: method.autoReceive,
        requiresAuthorization: method.requiresAuthorization,
        feePercentage: new Prisma.Decimal(method.feePercentage),
        settlementDays: method.settlementDays,
        isSystemDefault: true,
        isActive: true,
      },
    });
  }
}

/**
 * Calcula o valor líquido após descontar a taxa da forma de pagamento.
 */
export async function calculateNetAmount(paymentMethodId: string, grossAmount: number): Promise<{
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  settlementDays: number;
}> {
  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) return { grossAmount, feeAmount: 0, netAmount: grossAmount, settlementDays: 0 };

  const feeRate = Number(method.feePercentage) / 100;
  const feeAmount = grossAmount * feeRate;
  const netAmount = grossAmount - feeAmount;

  return {
    grossAmount,
    feeAmount: parseFloat(feeAmount.toFixed(2)),
    netAmount: parseFloat(netAmount.toFixed(2)),
    settlementDays: method.settlementDays,
  };
}
