import { Suspense } from 'react';
import FinancialFiscalForm from '@/components/configuracoes/financial-fiscal-form';

export const dynamic = 'force-dynamic';

export default function ConfiguracoesFinanceiroFiscalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Carregando configurações financeiro-fiscais...</div>}>
      <FinancialFiscalForm />
    </Suspense>
  );
}
