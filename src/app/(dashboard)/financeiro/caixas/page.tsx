import React from 'react';
import { getBankAccounts } from '@/lib/financial/financial-actions';
import { getCashRegisters, getCurrentOpenRegister } from '@/lib/financial/cash-register-service';
import CaixasClient from './CaixasClient';
import { requirePermission } from '@/lib/auth/permissions';

export default async function CashRegistersPage() {
  await requirePermission('CAIXA', 'VIEW');

  const [currentResult, historyResult, accountResult] = await Promise.all([
    getCurrentOpenRegister(),
    getCashRegisters(),
    getBankAccounts()
  ]);

  return (
    <CaixasClient 
      initialCurrent={currentResult.data || null} 
      initialHistory={historyResult.data || []} 
      bankAccounts={accountResult.data || []} 
    />
  );
}
