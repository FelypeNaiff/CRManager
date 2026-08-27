export function tenantMigrationWhere(companyId: string) {
  return {
    legacyReturns: { companyId },
    wallets: { customer: { companyId } },
    walletRecords: { wallet: { customer: { companyId } } },
    actor: (userId: string) => ({ id: userId, companyId, status: 'ACTIVE' }),
  } as const;
}

export function assertTenantMigrationLinks(input: {
  legacySaleIds: string[];
  tenantSaleIds: string[];
  legacyCustomerIds: string[];
  tenantCustomerIds: string[];
}) {
  const sales = new Set(input.tenantSaleIds);
  const customers = new Set(input.tenantCustomerIds);
  if (input.legacySaleIds.some(id => !sales.has(id)) || input.legacyCustomerIds.some(id => !customers.has(id))) {
    throw new Error('Dados legados sem vínculo inequívoco com a empresa autenticada.');
  }
}
