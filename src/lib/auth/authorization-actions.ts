'use server';
import { serializePrisma } from '@/lib/serialize';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/permissions';
import { authorizationService } from './authorization-service';
import { AuthorizationType } from './authorization-types';
import { canonicalAuthorizationModule } from './authorization-security';

const publicError = (fallback: string) => ({ success: false as const, error: fallback });

export async function createAuthorizationRequestAction(data: {
  type: AuthorizationType;
  module: string;
  referenceId?: string;
  referenceModule?: string;
  amount?: number;
  percentage?: number;
  reason?: string;
  metadata?: any;
  financialImpact?: boolean;
}) {
  try {
    const session = await requireAuth();

    const auth = await authorizationService.createAuthorizationRequest({
      ...data,
      companyId: session.companyId,
      requestedByUserId: session.userId,
      module: canonicalAuthorizationModule(data.type),
    });

    return { success: true as const, authorizationId: auth.id };
  } catch {
    return publicError('Falha ao solicitar autorização.');
  }
}

export async function approveAuthorizationWithPinAction(data: {
  authorizationId: string;
  pin: string;
  approvedAmount?: number;
  approvedPercentage?: number;
}) {
  try {
    const session = await requireAuth();

    const auth = await authorizationService.approveAuthorizationWithPin({
      ...data,
      companyId: session.companyId,
    });

    revalidatePath('/configuracoes/autorizacoes');
    return { success: true as const, authorization: { id: auth.id, status: auth.status, type: auth.type } };
  } catch {
    return publicError('Falha ao aprovar autorização.');
  }
}

export async function rejectAuthorizationWithPinAction(data: {
  authorizationId: string;
  pin: string;
  rejectionReason: string;
}) {
  try {
    const session = await requireAuth();

    const auth = await authorizationService.rejectAuthorizationWithPin({
      ...data,
      companyId: session.companyId,
    });

    revalidatePath('/configuracoes/autorizacoes');
    return { success: true as const, authorization: { id: auth.id, status: auth.status, type: auth.type } };
  } catch {
    return publicError('Falha ao rejeitar autorização.');
  }
}

export async function getPendingAuthorizationsAction() {
  try {
    const session = await requireAuth();
    const authorizations = await authorizationService.getPendingAuthorizations(session.companyId);
    return { success: true as const, data: serializePrisma(authorizations) };
  } catch {
    return publicError('Falha ao carregar autorizações.');
  }
}

export async function getAuthorizationHistoryAction() {
  try {
    const session = await requireAuth();
    const authorizations = await authorizationService.getAuthorizationHistory(session.companyId);
    return { success: true as const, data: serializePrisma(authorizations) };
  } catch {
    return publicError('Falha ao carregar histórico.');
  }
}
