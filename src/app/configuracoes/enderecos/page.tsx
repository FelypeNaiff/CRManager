import { Suspense } from 'react';
import AddressForm from '@/components/configuracoes/address-form';

export const dynamic = 'force-dynamic';

export default function ConfiguracoesEnderecosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Carregando endereço...</div>}>
      <AddressForm />
    </Suspense>
  );
}
