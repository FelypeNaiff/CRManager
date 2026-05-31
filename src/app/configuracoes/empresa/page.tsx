import { Suspense } from 'react';
import CompanyForm from '@/components/configuracoes/company-form';

export const dynamic = 'force-dynamic';

export default function ConfiguracoesEmpresaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Carregando configurações da empresa...</div>}>
      <CompanyForm />
    </Suspense>
  );
}
