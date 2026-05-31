import { Suspense } from 'react';
import FiscalForm from '@/components/configuracoes/fiscal-form';

export const dynamic = 'force-dynamic';

export default function FiscalConfigPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Carregando dados fiscais...</div>}>
      <FiscalForm />
    </Suspense>
  );
}
