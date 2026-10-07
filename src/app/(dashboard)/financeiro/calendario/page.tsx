import React from 'react';
import { requirePermission } from '@/lib/auth/permissions';
import { getFinancialCalendarAction } from '@/lib/financial/calendar-actions';
import CalendarioClient from './CalendarioClient';

export default async function FinancialCalendarPage(props: { searchParams: Promise<{ month?: string; year?: string }> }) {
  await requirePermission('FINANCEIRO', 'VIEW');

  const searchParams = await props.searchParams;
  const now = new Date();
  const month = searchParams.month ? parseInt(searchParams.month, 10) : now.getMonth() + 1;
  const year = searchParams.year ? parseInt(searchParams.year, 10) : now.getFullYear();

  const result = await getFinancialCalendarAction(month, year);
  
  if (!result.success) {
    throw new Error(result.error);
  }

  return (
    <CalendarioClient 
      initialMonth={month} 
      initialYear={year} 
      data={result.data as any} 
    />
  );
}
