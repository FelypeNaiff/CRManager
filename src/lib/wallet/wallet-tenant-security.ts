export type WalletAuthScope = Readonly<{
  companyId: string;
  userId: string;
  isAdmin?: boolean;
}>;

export function walletCustomerWhere(customerId: string, companyId: string) {
  return { id: customerId, companyId } as const;
}

export function walletForCustomerWhere(customerId: string, companyId: string) {
  return { customerId, customer: { companyId } } as const;
}

export function secureWalletActor(
  auth: WalletAuthScope,
  _untrusted?: { companyId?: string; userId?: string; createdById?: string },
) {
  return { companyId: auth.companyId, userId: auth.userId } as const;
}

export function approvedWalletAuthorizationWhere(
  id: string,
  companyId: string,
  customerId: string,
  type: 'WALLET_CREDIT' | 'WALLET_DEBIT',
) {
  return {
    id,
    companyId,
    status: 'APPROVED' as const,
    module: 'CARTEIRA',
    type,
    referenceId: customerId,
    referenceModule: 'CUSTOMER',
  } as const;
}
