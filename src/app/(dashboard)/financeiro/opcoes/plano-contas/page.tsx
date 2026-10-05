import React from 'react';
import { requirePermission } from '@/lib/auth/permissions';
import { getChartOfAccountsAction } from '@/lib/financial/chart-of-accounts-actions';
import PlanoContasClient from './PlanoContasClient';

export default async function PlanoContasPage() {
  await requirePermission('FINANCEIRO', 'VIEW');

  const result = await getChartOfAccountsAction();
  if (!result.success) throw new Error(result.error);

  return <PlanoContasClient initialData={result.data as any[]} />;
}
