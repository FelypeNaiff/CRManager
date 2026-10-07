import React from 'react';
import { requirePermission } from '@/lib/auth/permissions';
import { getPaymentMethodsAction } from '@/lib/financial/payment-methods-actions';
import FormasPagamentoClient from './FormasPagamentoClient';

export default async function FormasPagamentoPage() {
  await requirePermission('FINANCEIRO', 'VIEW');

  const result = await getPaymentMethodsAction();
  if (!result.success) throw new Error(result.error);

  return <FormasPagamentoClient initialData={result.data as any[]} />;
}
