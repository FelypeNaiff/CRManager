'use server';
import { serializePrisma } from '@/lib/serialize';

import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { addAuditChange, type AuditChanges } from '@/lib/auth/audit-changes';
import { prisma } from '@/lib/prisma';
import { OperationalSettingsService } from './operational-settings-service';

const OperationalSettingsFormSchema = z.object({
  allowDiscount: z.boolean().default(true),
  sellerDiscountLimit: z.preprocess((val) => Number(val || 0), z.number().min(0).max(100)),
  managerDiscountLimit: z.preprocess((val) => Number(val || 0), z.number().min(0).max(100)),
  adminDiscountLimit: z.preprocess((val) => Number(val || 0), z.number().min(0).max(100)),
  requireAuthorizationAboveLimit: z.boolean().default(true),

  requireOpenCashRegister: z.boolean().default(true),
  requireCloseCashRegister: z.boolean().default(true),
  allowCashWithdrawal: z.boolean().default(true),
  allowCashSupply: z.boolean().default(true),

  allowSaleWithoutCustomer: z.boolean().default(true),
  requireCustomerOnSale: z.boolean().default(false),
  allowNegativeStock: z.boolean().default(false),
  reserveStockOnDraftSale: z.boolean().default(false),
  allowSaleCancellation: z.boolean().default(true),
  requireAuthorizationToCancelSale: z.boolean().default(true),
  cancellationTimeLimit: z.preprocess((val) => Number(val || 0), z.number().int().min(0)),

  autoPrintReceipt: z.boolean().default(false),
  enableThermalPrinter: z.boolean().default(false),
  receiptModel: z.string().default('simples'),

  defaultPixKey: z.string().optional().nullable().or(z.literal('')),
  maxInstallments: z.preprocess((val) => Number(val || 1), z.number().int().min(1)),
  defaultInterestRate: z.preprocess((val) => Number(val || 0), z.number().min(0)),

  enableCommissions: z.boolean().default(true),
  defaultCommissionRate: z.preprocess((val) => Number(val || 0), z.number().min(0).max(100)),
  enableSellerGoals: z.boolean().default(true),

  enableCustomerWallet: z.boolean().default(true),
  walletExpirationDays: z.preprocess((val) => val === '' || val === null || val === undefined ? null : Number(val), z.number().int().min(1).nullable().optional()),
  allowPartialWalletUsage: z.boolean().default(true),
  walletDefaultRefundMethod: z.string().default('WALLET'),
  walletAllowManualCredit: z.boolean().default(true),
  walletAllowManualDebit: z.boolean().default(true),
  returnRequireAuthorization: z.boolean().default(true),
  exchangeRequireAuthorization: z.boolean().default(true),
});

/**
 * Action to fetch current operational settings.
 */
export async function getOperationalSettingsAction() {
  const session = await requirePermission('CONFIGURACOES_OPERACIONAIS', 'VIEW');
  try {
    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(session.companyId);
    return { success: true, data: serializePrisma(JSON.parse(JSON.stringify(settings)),) };
  } catch {
    return { success: false, error: 'Erro ao carregar configurações.' };
  }
}

/**
 * Action to update operational settings.
 */
export async function updateOperationalSettingsAction(rawData: any) {
  const session = await requirePermission('CONFIGURACOES_OPERACIONAIS', 'UPDATE');
  try {
    const validatedData = OperationalSettingsFormSchema.parse(rawData);
    const updated = await prisma.$transaction(async tx => {
      const before = await OperationalSettingsService.getOrCreateOperationalSettings(session.companyId, tx);
      const result = await OperationalSettingsService.updateOperationalSettings(session.companyId, validatedData, tx);
      const changes: AuditChanges = {};
      for (const [field, after] of Object.entries(validatedData)) {
        if (field === 'defaultPixKey') {
          addAuditChange(changes, field, before[field], after, { sensitive: true });
        } else {
          addAuditChange(changes, field, before[field], after);
        }
      }
      if (Object.keys(changes).length > 0) await writeActivityLog({
        context: session, action: 'OPERATIONAL_SETTINGS_UPDATE', module: 'OPERATIONAL_SETTINGS', recordId: result.id,
        details: 'Configurações operacionais atualizadas.', metadata: { changes },
      }, { policy: 'CRITICAL', tx });
      return result;
    });

    return { success: true, data: serializePrisma(JSON.parse(JSON.stringify(updated)),) };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: `Dados inválidos: ${fieldErrors}` };
    }
    return { success: false, error: 'Erro ao atualizar configurações.' };
  }
}

/**
 * Action to validate a discount policy.
 */
export async function validateDiscountPolicyAction(data: {
  discountPercent: number;
  saleTotal: number;
}) {
  const session = await requireAuth();
  try {
    const result = await OperationalSettingsService.validateDiscountPolicy({
      companyId: session.companyId,
      userId: session.userId,
      discountPercent: data.discountPercent,
      saleTotal: data.saleTotal,
    });
    return { success: true, ...result };
  } catch {
    return { success: false, error: 'Erro ao validar desconto.' };
  }
}

/**
 * Action to validate cash register policies.
 */
export async function validateCashRegisterPolicyAction(data: {
  action: 'sale' | 'withdrawal' | 'supply';
  cashRegisterId?: string;
}) {
  const session = await requireAuth();
  try {
    const result = await OperationalSettingsService.validateCashRegisterPolicy({
      companyId: session.companyId,
      action: data.action,
      cashRegisterId: data.cashRegisterId,
      userId: session.userId,
    });
    return { success: true, ...result };
  } catch {
    return { success: false, error: 'Erro ao validar caixa.' };
  }
}

/**
 * Action to validate sale policy.
 */
export async function validateSalePolicyAction(data: {
  hasCustomer: boolean;
  hasNegativeStock: boolean;
  isDraft?: boolean;
}) {
  const session = await requireAuth();
  try {
    const result = await OperationalSettingsService.validateSalePolicy({
      companyId: session.companyId,
      hasCustomer: data.hasCustomer,
      hasNegativeStock: data.hasNegativeStock,
      isDraft: data.isDraft,
    });
    return { success: true, ...result };
  } catch {
    return { success: false, error: 'Erro ao validar regras de venda.' };
  }
}
