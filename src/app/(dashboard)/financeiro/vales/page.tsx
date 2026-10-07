import React from 'react';
import { requirePermission } from '@/lib/auth/permissions';
import { getEmployeeAdvancesAction } from '@/lib/financial/employee-advances-actions';
import { getUsersAction } from '@/lib/users/user-actions';
import { getCurrentOpenRegister } from '@/lib/financial/cash-register-service';
import ValesClient from './ValesClient';

export default async function ValesPage(props: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission('FINANCEIRO', 'VIEW');

  const searchParams = await props.searchParams;
  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const monthFilter = searchParams.month || currentMonthStr;

  const [valesResult, usersResult, caixaResult] = await Promise.all([
    getEmployeeAdvancesAction(monthFilter),
    getUsersAction(), // assumindo que retorna funcionárias
    getCurrentOpenRegister()
  ]);

  if (!valesResult.success) throw new Error(valesResult.error);

  return (
    <ValesClient 
      initialData={(valesResult.data as any[]) || []} 
      users={usersResult.data || []} 
      currentMonth={monthFilter}
      openRegister={caixaResult.success ? caixaResult.data : null}
    />
  );
}
