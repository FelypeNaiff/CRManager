export type FinancialAuthScope = Readonly<{
  companyId: string;
  userId: string;
  isAdmin?: boolean;
}>;

export function financialTenantWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}

export function secureFinancialActor(
  auth: FinancialAuthScope,
  _untrusted?: { companyId?: string; userId?: string; operatorId?: string },
) {
  return { companyId: auth.companyId, userId: auth.userId } as const;
}

export function cashMovementPermission(type: 'REFORCO' | 'SANGRIA' | 'AJUSTE') {
  if (type === 'REFORCO') return 'CASH_SUPPLY' as const;
  if (type === 'SANGRIA') return 'CASH_WITHDRAWAL' as const;
  return 'AUTHORIZE_MOVEMENT' as const;
}

export function approvedCashAuthorizationWhere(
  id: string,
  companyId: string,
  cashRegisterId: string,
  type: 'CASH_SUPPLY' | 'CASH_WITHDRAWAL',
) {
  return {
    id,
    companyId,
    status: 'APPROVED' as const,
    module: 'CAIXA',
    type,
    referenceId: cashRegisterId,
    referenceModule: 'CASH_REGISTER',
  } as const;
}

export function safeFinancialError(
  error: unknown,
  fallback: string,
  allowedMessages: readonly string[] = [],
) {
  if (error instanceof Error && allowedMessages.includes(error.message)) return error.message;
  return fallback;
}
