import React from 'react';
import { requirePermission } from '@/lib/auth/permissions';
import { getTransfersAction } from '@/lib/financial/transfers-actions';
import { getBankAccounts } from '@/lib/financial/financial-actions';
import TransferenciasClient from './TransferenciasClient';

export default async function TransferenciasPage() {
  await requirePermission('FINANCEIRO', 'VIEW');

  const [transfersRes, accountsRes] = await Promise.all([
    getTransfersAction(),
    getBankAccounts()
  ]);

  if (!transfersRes.success) throw new Error(transfersRes.error);

  return <TransferenciasClient initialData={transfersRes.data as any[]} bankAccounts={accountsRes.success ? (accountsRes.data as any[]) : []} />;
}
