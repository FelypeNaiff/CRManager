'use server';

import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
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
});

/**
 * Action to fetch current operational settings.
 */
export async function getOperationalSettingsAction() {
  const session = await requireAuth();
  try {
    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(session.companyId);
    return {
      success: true,
      data: JSON.parse(JSON.stringify(settings)),
    };
  } catch (error: any) {
    console.error('Error in getOperationalSettingsAction:', error);
    return { success: false, error: error.message || 'Erro ao carregar configurações.' };
  }
}

/**
 * Action to update operational settings.
 */
export async function updateOperationalSettingsAction(rawData: any) {
  const session = await requirePermission('Configurações gerais', 'editar');
  try {
    const validatedData = OperationalSettingsFormSchema.parse(rawData);
    const updated = await OperationalSettingsService.updateOperationalSettings(
      session.companyId,
      validatedData
    );

    // Record activity log
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'CONFIGURACOES',
      recordId: updated.id,
      details: 'Atualização das configurações operacionais e PDV',
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updated)),
    };
  } catch (error: any) {
    console.error('Error in updateOperationalSettingsAction:', error);
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: `Dados inválidos: ${fieldErrors}` };
    }
    return { success: false, error: error.message || 'Erro ao atualizar configurações.' };
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
  } catch (error: any) {
    console.error('Error in validateDiscountPolicyAction:', error);
    return { success: false, error: error.message || 'Erro ao validar desconto.' };
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
  } catch (error: any) {
    console.error('Error in validateCashRegisterPolicyAction:', error);
    return { success: false, error: error.message || 'Erro ao validar caixa.' };
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
  } catch (error: any) {
    console.error('Error in validateSalePolicyAction:', error);
    return { success: false, error: error.message || 'Erro ao validar regras de venda.' };
  }
}
