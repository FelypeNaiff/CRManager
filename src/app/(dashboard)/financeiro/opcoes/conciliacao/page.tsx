import React from 'react';
import { requirePermission } from '@/lib/auth/permissions';
import { getBankAccountsForReconciliationAction } from '@/lib/financial/reconciliation-actions';
import ConciliacaoClient from './ConciliacaoClient';

export default async function ConciliacaoPage() {
  await requirePermission('FINANCEIRO', 'VIEW');

  const result = await getBankAccountsForReconciliationAction();
  if (!result.success) throw new Error(result.error);

  return <ConciliacaoClient bankAccounts={result.data as any[]} />;
}
