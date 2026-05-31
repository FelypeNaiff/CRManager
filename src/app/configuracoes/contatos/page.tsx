import { Suspense } from 'react';
import ContactForm from '@/components/configuracoes/contact-form';

export const dynamic = 'force-dynamic';

export default function ConfiguracoesContatosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Carregando contatos...</div>}>
      <ContactForm />
    </Suspense>
  );
}
