import { prisma } from '@/lib/prisma';
import { validatePin } from './pin-service';
import { AuthorizationType, AuthorizationStatus, AUTHORIZATION_PERMISSION_MAP } from './authorization-types';

export class AuthorizationService {
  /**
   * Checks if an authorizer has the RBAC permissions to authorize an action.
   */
  async canAuthorizeAction(
    authorizationType: AuthorizationType,
    requesterId: string,
    authorizerId: string,
    companyId: string,
    amount?: number,
    percentage?: number
  ) {
    if (requesterId === authorizerId) {
      throw new Error('Usuário não pode autorizar a própria operação.');
    }

    const authorizer = await prisma.user.findUnique({
      where: { id: authorizerId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!authorizer || authorizer.status !== 'ACTIVE' || authorizer.companyId !== companyId) {
      throw new Error('Autorizador inválido ou inativo.');
    }

    if (!authorizer.permitirAcesso) {
      throw new Error('Autorizador sem permissão de acesso ao sistema.');
    }

    if (authorizer.pinResetRequired) {
      throw new Error('O PIN do autorizador expirou/precisa ser redefinido no primeiro acesso.');
    }

    const isAdmin = authorizer.role?.isAdmin || false;
    if (isAdmin) return authorizer; // Admins bypass RBAC module check

    const requiredPermission = AUTHORIZATION_PERMISSION_MAP[authorizationType];
    
    if (requiredPermission) {
      const hasPermission = authorizer.role?.permissions.some(
        (p) =>
          p.module === requiredPermission.module &&
          p.action === requiredPermission.action &&
          p.allowed
      );

      if (!hasPermission) {
        throw new Error(
          `Usuário ${authorizer.name} não possui a permissão RBAC (${requiredPermission.module}:${requiredPermission.action}) necessária para esta autorização.`
        );
      }
    } else {
      throw new Error(`Tipo de autorização ${authorizationType} não mapeado no catálogo RBAC.`);
    }

    return authorizer;
  }

  /**
   * Validates a plaintext PIN and returns the valid authorizer user if they have permission.
   */
  async validateAuthorizationPin(
    companyId: string,
    pin: string,
    authorizationType: AuthorizationType,
    requesterId: string,
    amount?: number,
    percentage?: number
  ) {
    if (!pin) {
      throw new Error('PIN de autorização é obrigatório.');
    }

    const activeUsersWithPin = await prisma.user.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        permitirAcesso: true,
        authorizationPinHash: { not: null },
      },
    });

    let authorizer = null;

    for (const user of activeUsersWithPin) {
      if (!user.authorizationPinHash) continue;
      const isValid = await validatePin(pin, user.authorizationPinHash);
      if (isValid) {
        authorizer = user;
        break;
      }
    }

    if (!authorizer) {
      throw new Error('PIN de autorização inválido.');
    }

    // Now check RBAC rules
    return await this.canAuthorizeAction(
      authorizationType,
      requesterId,
      authorizer.id,
      companyId,
      amount,
      percentage
    );
  }

  /**
   * Creates a new generic ActionAuthorization request.
   */
  async createAuthorizationRequest(data: {
    companyId: string;
    type: AuthorizationType;
    module: string;
    requestedByUserId: string;
    referenceId?: string;
    referenceModule?: string;
    amount?: number;
    percentage?: number;
    reason?: string;
    metadata?: any;
    financialImpact?: boolean;
  }) {
    return prisma.actionAuthorization.create({
      data: {
        companyId: data.companyId,
        type: data.type,
        module: data.module,
        status: AuthorizationStatus.PENDING,
        requestedByUserId: data.requestedByUserId,
        referenceId: data.referenceId,
        referenceModule: data.referenceModule,
        amount: data.amount,
        percentage: data.percentage,
        reason: data.reason,
        metadata: data.metadata || {},
        financialImpact: data.financialImpact || false,
        // Expira em 15 minutos
        expiresAt: new Date(Date.now() + 15 * 60000), 
      },
    });
  }

  /**
   * Approves an authorization request.
   */
  async approveAuthorization(data: {
    authorizationId: string;
    authorizerId: string;
    companyId: string;
    approvedAmount?: number;
    approvedPercentage?: number;
  }, tx?: any) {
    const db = tx || prisma;
    const auth = await db.actionAuthorization.findUnique({
      where: { id: data.authorizationId, companyId: data.companyId },
    });

    if (!auth) throw new Error('Autorização não encontrada.');
    if (auth.status !== AuthorizationStatus.PENDING) {
      throw new Error(`A autorização não está mais pendente (Status: ${auth.status}).`);
    }

    if (auth.expiresAt && auth.expiresAt < new Date()) {
      throw new Error('A solicitação de autorização expirou.');
    }

    // Fetch authorizer role details to snapshot
    const authorizer = await this.canAuthorizeAction(
      auth.type as AuthorizationType,
      auth.requestedByUserId,
      data.authorizerId,
      data.companyId,
      data.approvedAmount || Number(auth.amount),
      data.approvedPercentage || Number(auth.percentage)
    );

    return db.actionAuthorization.update({
      where: { id: data.authorizationId },
      data: {
        status: AuthorizationStatus.APPROVED,
        authorizedByUserId: data.authorizerId,
        authorizedAt: new Date(),
        authorizerRoleId: authorizer.roleId,
        authorizerRoleName: authorizer.role?.name,
        approvedAmount: data.approvedAmount ?? auth.amount,
        approvedPercentage: data.approvedPercentage ?? auth.percentage,
      },
    });
  }

  /**
   * Rejects an authorization request.
   */
  async rejectAuthorization(data: {
    authorizationId: string;
    rejecterId: string;
    companyId: string;
    rejectionReason: string;
  }, tx?: any) {
    const db = tx || prisma;
    const auth = await db.actionAuthorization.findUnique({
      where: { id: data.authorizationId, companyId: data.companyId },
    });

    if (!auth) throw new Error('Autorização não encontrada.');
    if (auth.status !== AuthorizationStatus.PENDING) {
      throw new Error(`A autorização não está pendente (Status: ${auth.status}).`);
    }

    return db.actionAuthorization.update({
      where: { id: data.authorizationId },
      data: {
        status: AuthorizationStatus.REJECTED,
        rejectedByUserId: data.rejecterId,
        rejectedAt: new Date(),
        rejectionReason: data.rejectionReason,
      },
    });
  }

  async getPendingAuthorizations(companyId: string) {
    return prisma.actionAuthorization.findMany({
      where: { companyId, status: AuthorizationStatus.PENDING },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getAuthorizationHistory(companyId: string) {
    return prisma.actionAuthorization.findMany({
      where: { companyId, status: { not: AuthorizationStatus.PENDING } },
      orderBy: { updatedAt: 'desc' },
      take: 100, // Recent history
    });
  }

  async getAuthorizationById(id: string, companyId: string) {
    return prisma.actionAuthorization.findUnique({
      where: { id, companyId },
    });
  }
}

export const authorizationService = new AuthorizationService();
