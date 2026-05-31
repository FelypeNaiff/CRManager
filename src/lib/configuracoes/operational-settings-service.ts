import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface DiscountPolicyParams {
  companyId: string;
  userId: string;
  roleId?: string;
  roleName?: string;
  discountPercent: number;
  saleTotal: number;
}

export interface CashRegisterPolicyParams {
  companyId: string;
  action: 'sale' | 'withdrawal' | 'supply';
  cashRegisterId?: string;
  userId?: string;
}

export interface SalePolicyParams {
  companyId: string;
  hasCustomer: boolean;
  hasNegativeStock: boolean;
  isDraft?: boolean;
}

export const OperationalSettingsService = {
  /**
   * Retrieves the operational settings for a company.
   */
  async getOperationalSettings(companyId: string, tx?: any) {
    const client = tx || prisma;
    return client.operationalSettings.findUnique({
      where: { companyId },
    });
  },

  /**
   * Retrieves or creates operational settings with safe defaults.
   */
  async getOrCreateOperationalSettings(companyId: string, tx?: any) {
    const client = tx || prisma;
    let settings = await client.operationalSettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      settings = await client.operationalSettings.create({
        data: {
          companyId,
          allowDiscount: true,
          sellerDiscountLimit: new Prisma.Decimal(5.0),
          managerDiscountLimit: new Prisma.Decimal(10.0),
          adminDiscountLimit: new Prisma.Decimal(100.0),
          requireAuthorizationAboveLimit: true,
          requireOpenCashRegister: true,
          requireCloseCashRegister: true,
          allowCashWithdrawal: true,
          allowCashSupply: true,
          allowSaleWithoutCustomer: true,
          requireCustomerOnSale: false,
          allowNegativeStock: false,
          reserveStockOnDraftSale: false,
          allowSaleCancellation: true,
          requireAuthorizationToCancelSale: true,
          cancellationTimeLimit: 30,
          autoPrintReceipt: false,
          enableThermalPrinter: false,
          receiptModel: 'simples',
          maxInstallments: 1,
          defaultInterestRate: new Prisma.Decimal(0.0),
          enableCommissions: true,
          defaultCommissionRate: new Prisma.Decimal(0.0),
          enableSellerGoals: true,
          enableCustomerWallet: true,
          walletExpirationDays: null,
          allowPartialWalletUsage: true,
        },
      });
    }

    return settings;
  },

  /**
   * Updates the operational settings.
   */
  async updateOperationalSettings(companyId: string, data: any, tx?: any) {
    const client = tx || prisma;
    return client.operationalSettings.upsert({
      where: { companyId },
      update: {
        allowDiscount: data.allowDiscount,
        sellerDiscountLimit: new Prisma.Decimal(data.sellerDiscountLimit),
        managerDiscountLimit: new Prisma.Decimal(data.managerDiscountLimit),
        adminDiscountLimit: new Prisma.Decimal(data.adminDiscountLimit),
        requireAuthorizationAboveLimit: data.requireAuthorizationAboveLimit,
        requireOpenCashRegister: data.requireOpenCashRegister,
        requireCloseCashRegister: data.requireCloseCashRegister,
        allowCashWithdrawal: data.allowCashWithdrawal,
        allowCashSupply: data.allowCashSupply,
        allowSaleWithoutCustomer: data.allowSaleWithoutCustomer,
        requireCustomerOnSale: data.requireCustomerOnSale,
        allowNegativeStock: data.allowNegativeStock,
        reserveStockOnDraftSale: data.reserveStockOnDraftSale,
        allowSaleCancellation: data.allowSaleCancellation,
        requireAuthorizationToCancelSale: data.requireAuthorizationToCancelSale,
        cancellationTimeLimit: Number(data.cancellationTimeLimit),
        autoPrintReceipt: data.autoPrintReceipt,
        enableThermalPrinter: data.enableThermalPrinter,
        receiptModel: data.receiptModel,
        defaultPixKey: data.defaultPixKey || null,
        maxInstallments: Number(data.maxInstallments),
        defaultInterestRate: new Prisma.Decimal(data.defaultInterestRate),
        enableCommissions: data.enableCommissions,
        defaultCommissionRate: new Prisma.Decimal(data.defaultCommissionRate),
        enableSellerGoals: data.enableSellerGoals,
        enableCustomerWallet: data.enableCustomerWallet,
        walletExpirationDays: data.walletExpirationDays ? Number(data.walletExpirationDays) : null,
        allowPartialWalletUsage: data.allowPartialWalletUsage,
      },
      create: {
        companyId,
        allowDiscount: data.allowDiscount,
        sellerDiscountLimit: new Prisma.Decimal(data.sellerDiscountLimit),
        managerDiscountLimit: new Prisma.Decimal(data.managerDiscountLimit),
        adminDiscountLimit: new Prisma.Decimal(data.adminDiscountLimit),
        requireAuthorizationAboveLimit: data.requireAuthorizationAboveLimit,
        requireOpenCashRegister: data.requireOpenCashRegister,
        requireCloseCashRegister: data.requireCloseCashRegister,
        allowCashWithdrawal: data.allowCashWithdrawal,
        allowCashSupply: data.allowCashSupply,
        allowSaleWithoutCustomer: data.allowSaleWithoutCustomer,
        requireCustomerOnSale: data.requireCustomerOnSale,
        allowNegativeStock: data.allowNegativeStock,
        reserveStockOnDraftSale: data.reserveStockOnDraftSale,
        allowSaleCancellation: data.allowSaleCancellation,
        requireAuthorizationToCancelSale: data.requireAuthorizationToCancelSale,
        cancellationTimeLimit: Number(data.cancellationTimeLimit),
        autoPrintReceipt: data.autoPrintReceipt,
        enableThermalPrinter: data.enableThermalPrinter,
        receiptModel: data.receiptModel,
        defaultPixKey: data.defaultPixKey || null,
        maxInstallments: Number(data.maxInstallments),
        defaultInterestRate: new Prisma.Decimal(data.defaultInterestRate),
        enableCommissions: data.enableCommissions,
        defaultCommissionRate: new Prisma.Decimal(data.defaultCommissionRate),
        enableSellerGoals: data.enableSellerGoals,
        enableCustomerWallet: data.enableCustomerWallet,
        walletExpirationDays: data.walletExpirationDays ? Number(data.walletExpirationDays) : null,
        allowPartialWalletUsage: data.allowPartialWalletUsage,
      },
    });
  },

  /**
   * Validates discount policies using dynamic/soft check logic based on user permissions
   * and roles instead of static hardcoded role names.
   */
  async validateDiscountPolicy(params: DiscountPolicyParams, tx?: any) {
    const client = tx || prisma;
    const settings = await this.getOrCreateOperationalSettings(params.companyId, client);

    if (!settings.allowDiscount) {
      return {
        allowed: false,
        requiresAuthorization: false,
        limitApplied: 0,
        reason: 'Descontos desabilitados globalmente nas configurações operacionais.',
      };
    }

    const user = await client.user.findUnique({
      where: { id: params.userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado para validação da política de desconto.');
    }

    // Hierarquia Dinâmica:
    // 1. Limite explícito de desconto no cadastro do Usuário.
    // 2. Limite explícito de desconto no perfil (Role) do Usuário.
    // 3. Se o perfil for Administrador (isAdmin = true), aplicar limite de Administrador das configurações operacionais.
    // 4. Se o usuário possuir permissão para autorizar descontos (PDV:editar ou similar), aplicar limite de Gerente.
    // 5. Caso contrário, aplicar limite de Vendedor.
    let limitApplied = 0;

    if (user.maxDiscountPercentage !== null) {
      limitApplied = Number(user.maxDiscountPercentage);
    } else if (user.role?.maxDiscountPercentage !== null && user.role?.maxDiscountPercentage !== undefined) {
      limitApplied = Number(user.role.maxDiscountPercentage);
    } else if (user.role?.isAdmin) {
      limitApplied = Number(settings.adminDiscountLimit);
    } else {
      const hasAuthorizePermission = user.role?.permissions.some(
        (p: any) =>
          p.module.toLowerCase() === 'pdv' &&
          ['editar', 'criar'].includes(p.action.toLowerCase()) &&
          p.allowed
      );

      if (hasAuthorizePermission) {
        limitApplied = Number(settings.managerDiscountLimit);
      } else {
        limitApplied = Number(settings.sellerDiscountLimit);
      }
    }

    const isAllowed = params.discountPercent <= limitApplied;

    if (isAllowed) {
      return {
        allowed: true,
        requiresAuthorization: false,
        limitApplied,
      };
    }

    // Se o desconto ultrapassar o limite, verificar se exige autorização
    if (settings.requireAuthorizationAboveLimit) {
      return {
        allowed: false,
        requiresAuthorization: true,
        limitApplied,
        reason: `O desconto de ${params.discountPercent.toFixed(2)}% excede o seu limite de ${limitApplied.toFixed(2)}% e requer autorização de um gerente/administrador.`,
      };
    }

    return {
      allowed: false,
      requiresAuthorization: false,
      limitApplied,
      reason: `Desconto de ${params.discountPercent.toFixed(2)}% não permitido. Seu limite é de ${limitApplied.toFixed(2)}%.`,
    };
  },

  /**
   * Validates cashier operations like sales, sangria, and reforço.
   */
  async validateCashRegisterPolicy(params: CashRegisterPolicyParams, tx?: any) {
    const client = tx || prisma;
    const settings = await this.getOrCreateOperationalSettings(params.companyId, client);

    if (settings.requireOpenCashRegister && params.action === 'sale') {
      const openRegister = await client.cashRegister.findFirst({
        where: {
          companyId: params.companyId,
          status: 'OPEN',
          ...(params.userId ? { openedByUserId: params.userId } : {}),
        },
      });

      if (!openRegister) {
        return {
          allowed: false,
          reason: 'Operação bloqueada: Abertura de caixa obrigatória para realizar vendas.',
        };
      }
    }

    if (params.action === 'withdrawal' && !settings.allowCashWithdrawal) {
      return {
        allowed: false,
        reason: 'Operação bloqueada: Sangria não permitida pelas configurações operacionais.',
      };
    }

    if (params.action === 'supply' && !settings.allowCashSupply) {
      return {
        allowed: false,
        reason: 'Operação bloqueada: Reforço não permitido pelas configurações operacionais.',
      };
    }

    return {
      allowed: true,
    };
  },

  /**
   * Validates general sale policies (customer requirements, stock level, draft reservation).
   */
  async validateSalePolicy(params: SalePolicyParams, tx?: any) {
    const client = tx || prisma;
    const settings = await this.getOrCreateOperationalSettings(params.companyId, client);

    // Cliente Obrigatório
    const blockNoCustomer = !settings.allowSaleWithoutCustomer || settings.requireCustomerOnSale;
    if (blockNoCustomer && !params.hasCustomer) {
      return {
        allowed: false,
        reason: 'Operação bloqueada: Cliente é obrigatório para concluir a venda.',
      };
    }

    // Estoque Negativo
    if (!settings.allowNegativeStock && params.hasNegativeStock) {
      return {
        allowed: false,
        reason: 'Operação bloqueada: Estoque insuficiente. Estoque negativo desativado.',
      };
    }

    return {
      allowed: true,
      reserveStock: settings.reserveStockOnDraftSale && params.isDraft,
    };
  },
};
