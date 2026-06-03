'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/permissions';
import { authorizationService } from './authorization-service';
import { AuthorizationType } from './authorization-types';

export async function validateAuthorizationPinAction(data: {
  pin: string;
  authorizationType: AuthorizationType;
  amount?: number;
  percentage?: number;
}) {
  try {
    const session = await requireAuth();

    // Validates the PIN and returns the authorizer user if successful and authorized
    const authorizer = await authorizationService.validateAuthorizationPin(
      session.companyId,
      data.pin,
      data.authorizationType,
      session.userId, // requester is the currently logged in user
      data.amount,
      data.percentage
    );

    return { success: true, authorizerId: authorizer.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao validar PIN de autorização.' };
  }
}

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
      companyId: session.companyId,
      requestedByUserId: session.userId,
      ...data,
    });

    return { success: true, authorizationId: auth.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao solicitar autorização.' };
  }
}

export async function approveAuthorizationAction(data: {
  authorizationId: string;
  authorizerId: string; // The ID of the user whose PIN was validated
  approvedAmount?: number;
  approvedPercentage?: number;
}) {
  try {
    const session = await requireAuth();

    const auth = await authorizationService.approveAuthorization({
      companyId: session.companyId,
      ...data,
    });

    revalidatePath('/configuracoes/autorizacoes');
    return { success: true, authorization: auth };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao aprovar autorização.' };
  }
}

export async function rejectAuthorizationAction(data: {
  authorizationId: string;
  rejecterId: string;
  rejectionReason: string;
}) {
  try {
    const session = await requireAuth();

    const auth = await authorizationService.rejectAuthorization({
      companyId: session.companyId,
      ...data,
    });

    revalidatePath('/configuracoes/autorizacoes');
    return { success: true, authorization: auth };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao rejeitar autorização.' };
  }
}

export async function getPendingAuthorizationsAction() {
  try {
    const session = await requireAuth();
    const authorizations = await authorizationService.getPendingAuthorizations(session.companyId);
    return { success: true, data: authorizations };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao carregar autorizações.' };
  }
}

export async function getAuthorizationHistoryAction() {
  try {
    const session = await requireAuth();
    const authorizations = await authorizationService.getAuthorizationHistory(session.companyId);
    return { success: true, data: authorizations };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao carregar histórico.' };
  }
}
