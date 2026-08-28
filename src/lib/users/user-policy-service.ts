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

}

export const userPolicyService = new UserPolicyService();
