import { prisma } from '@/lib/prisma';
import { OperationalSettingsService } from '@/lib/configuracoes/operational-settings-service';

export class UserPolicyService {
  /**
   * Resolve o limite de desconto de um usuário seguindo a hierarquia:
   * 1. Limite individual do Usuário (User.maxDiscountPercentage)
   * 2. Limite padrão do Grupo (Role.defaultMaxDiscountPercentage)
   * 3. Limite global de vendedor (OperationalSettings.sellerDiscountLimit)
   */
  async resolveUserDiscountLimit(userId: string, companyId: string, tx: any = prisma): Promise<number> {
    const user = await tx.user.findFirst({
      where: { id: userId, companyId },
      include: { role: true }
    });

    if (!user) throw new Error('Usuário não encontrado.');

    // 1. Limite Individual
    if (user.maxDiscountPercentage !== null && user.maxDiscountPercentage !== undefined) {
      return Number(user.maxDiscountPercentage);
    }

    // 2. Limite do Grupo
    if (user.role?.defaultMaxDiscountPercentage !== null && user.role?.defaultMaxDiscountPercentage !== undefined) {
      return Number(user.role.defaultMaxDiscountPercentage);
    }

    // 3. Limite Global
    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(companyId, tx);
    return Number(settings.sellerDiscountLimit || 0);
  }

  /**
   * Resolve a comissão de um usuário seguindo a hierarquia:
   * 1. Comissão individual do Usuário (User.commissionRate) -> Se for 0, ignora (ou assume que 0 é usar do grupo/global dependendo da regra de negócio. Para NEEX, se > 0 usa, se 0 busca fallback)
   * Wait, if the user explicitly has a commission of 0, how do we distinguish between "no commission" and "inherit"?
   * Usually, if commissionRate is null it inherits. But Prisma schema has commissionRate Decimal @default(0.00). 
   * So we will assume that if it's > 0, it uses it. If it is 0, it inherits. If the inherited is also 0, then commission is 0.
   */
  async resolveUserCommissionRate(userId: string, companyId: string, tx: any = prisma): Promise<number> {
    const user = await tx.user.findFirst({
      where: { id: userId, companyId },
      include: { role: true }
    });

    if (!user) throw new Error('Usuário não encontrado.');

    // 1. Comissão Individual (se maior que 0)
    // Caso o cliente queira forçar 0 de comissão para um usuário específico cujo grupo tem 5%, precisaria de uma flag ou de permitir null no BD. 
    // Como o schema atual define @default(0.00) e not null, usaremos a heurística > 0.
    const userCommission = Number(user.commissionRate);
    if (userCommission > 0) {
      return userCommission;
    }

    // 2. Comissão do Grupo
    if (user.role?.defaultCommissionRate !== null && user.role?.defaultCommissionRate !== undefined) {
      const roleCommission = Number(user.role.defaultCommissionRate);
      if (roleCommission > 0) {
        return roleCommission;
      }
    }

    // 3. Comissão Global
    const settings = await OperationalSettingsService.getOrCreateOperationalSettings(companyId, tx);
    return Number(settings.defaultCommissionRate || 0);
  }
}

export const userPolicyService = new UserPolicyService();
