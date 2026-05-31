import { prisma } from '@/lib/prisma';
import { verifyPin } from './pin';

export interface RequiredPermission {
  module: string;
  action: string;
}

export class AuthorizationService {
  /**
   * Validates a plaintext PIN and checks if the matching user is active and authorized.
   * If a permission is required, it checks if the user is an admin or possesses that permission.
   */
  async validatePinAuthorization(
    companyId: string,
    pin: string,
    requiredPermission?: RequiredPermission
  ) {
    if (!pin) {
      throw new Error('PIN de autorização é obrigatório.');
    }

    // Fetch all active users for the company who have a set PIN
    const activeUsers = await prisma.user.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        permitirAcesso: true,
        pinAccessHash: { not: '' },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    let authorizer = null;

    // Verify PIN against stored hashes
    for (const user of activeUsers) {
      if (!user.pinAccessHash) continue;
      const isValid = await verifyPin(pin, user.pinAccessHash);
      if (isValid) {
        authorizer = user;
        break;
      }
    }

    if (!authorizer) {
      throw new Error('PIN de autorização inválido.');
    }

    // Check authorization rules dynamically (Soft check, no fixed Role names)
    const isAdmin = authorizer.role?.isAdmin || false;

    if (requiredPermission) {
      const hasPermission =
        isAdmin ||
        authorizer.role?.permissions.some(
          (p) =>
            p.module.toLowerCase() === requiredPermission.module.toLowerCase() &&
            p.action.toLowerCase() === requiredPermission.action.toLowerCase() &&
            p.allowed
        );

      if (!hasPermission) {
        throw new Error(
          `Usuário ${authorizer.name} não possui permissão (${requiredPermission.module}:${requiredPermission.action}) para esta autorização.`
        );
      }
    } else {
      // Fallback: If no specific permission is required, verify if user has some manager/admin privilege
      // (either is admin or has edit rights on PDV/Caixa/Vendas modules)
      const hasManagerPrivilege =
        isAdmin ||
        authorizer.role?.permissions.some(
          (p) =>
            ['pdv', 'caixa', 'vendas', 'configurações gerais', 'sistema'].includes(p.module.toLowerCase()) &&
            ['editar', 'criar', 'excluir'].includes(p.action.toLowerCase()) &&
            p.allowed
        );

      if (!hasManagerPrivilege) {
        throw new Error(`Usuário ${authorizer.name} não possui nível de autorização suficiente.`);
      }
    }

    return authorizer;
  }

  /**
   * Helper to create a SaleAuthorization record.
   */
  async createAuthorizationRequest(tx: any, data: {
    saleId: string;
    requestedByUserId: string;
    authorizedByUserId: string;
    type: 'DISCOUNT_OVER_LIMIT' | 'CANCEL_SALE';
    status: 'APPROVED' | 'PENDING' | 'DENIED';
    reason?: string;
    requestedDiscount: number;
    allowedDiscount: number;
  }) {
    return tx.saleAuthorization.create({
      data: {
        saleId: data.saleId,
        requestedByUserId: data.requestedByUserId,
        authorizedByUserId: data.authorizedByUserId,
        type: data.type,
        status: data.status,
        reason: data.reason || 'Sem motivo informado',
        requestedDiscount: data.requestedDiscount,
        allowedDiscount: data.allowedDiscount,
      },
    });
  }
}

export const authorizationService = new AuthorizationService();
