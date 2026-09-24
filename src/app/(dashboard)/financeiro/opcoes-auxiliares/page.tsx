import {
  createCostCenter,
  createFinancialAccount,
  createPaymentMethod,
  deletePaymentMethod,
  getCostCenters,
  getFinancialAccounts,
  getPaymentMethods,
  updatePaymentMethod,
} from '@/lib/financial/financial-actions';
import { revalidatePath } from 'next/cache';

const paymentTypes = [
  ['CASH', 'Dinheiro'],
  ['DEBIT_CARD', 'Cartão de débito'],
  ['CREDIT_CARD', 'Cartão de crédito'],
  ['PIX', 'PIX'],
  ['BANK_TRANSFER', 'Transferência bancária'],
  ['STORE_CREDIT', 'Crediário'],
  ['CHECK', 'Cheque'],
  ['OTHER', 'Outro'],
] as const;

function paymentMethodInput(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    type: String(formData.get('type') ?? 'OTHER'),
    allowsInstallments: formData.get('allowsInstallments') === 'on',
    autoReceive: formData.get('autoReceive') === 'on',
    requiresAuthorization: formData.get('requiresAuthorization') === 'on',
    feePercentage: Number(formData.get('feePercentage') ?? 0),
    settlementDays: Number(formData.get('settlementDays') ?? 0),
  };
}

async function addCenter(formData: FormData) {
  'use server';
  await createCostCenter({ name: String(formData.get('name')), code: String(formData.get('code') || '') });
  revalidatePath('/financeiro/opcoes-auxiliares');
}

async function addAccount(formData: FormData) {
  'use server';
  await createFinancialAccount({
    code: String(formData.get('code')),
    name: String(formData.get('name')),
    type: String(formData.get('type')),
    acceptsEntries: true,
  });
  revalidatePath('/financeiro/opcoes-auxiliares');
}

async function addMethod(formData: FormData) {
  'use server';
  await createPaymentMethod(paymentMethodInput(formData));
  revalidatePath('/financeiro/opcoes-auxiliares');
  revalidatePath('/pdv');
}

async function editMethod(formData: FormData) {
  'use server';
  await updatePaymentMethod(String(formData.get('id')), paymentMethodInput(formData));
  revalidatePath('/financeiro/opcoes-auxiliares');
  revalidatePath('/pdv');
}

async function archiveMethod(formData: FormData) {
  'use server';
  await deletePaymentMethod(String(formData.get('id')));
  revalidatePath('/financeiro/opcoes-auxiliares');
  revalidatePath('/pdv');
}

function PaymentFields({ method }: { method?: any }) {
  return (
    <>
      <input className="rounded border p-2" name="name" placeholder="Nome" defaultValue={method?.name ?? ''} required />
      <select className="rounded border p-2" name="type" defaultValue={method?.type ?? 'CASH'}>
        {paymentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Taxa (%)
          <input className="mt-1 w-full rounded border p-2 text-foreground" name="feePercentage" type="number" min="0" max="100" step="0.01" defaultValue={Number(method?.feePercentage ?? 0)} />
        </label>
        <label className="text-xs text-muted-foreground">
          Liquidação (dias)
          <input className="mt-1 w-full rounded border p-2 text-foreground" name="settlementDays" type="number" min="0" step="1" defaultValue={method?.settlementDays ?? 0} />
        </label>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <label className="flex items-center gap-2"><input name="allowsInstallments" type="checkbox" defaultChecked={method?.allowsInstallments ?? false} /> Permite parcelar</label>
        <label className="flex items-center gap-2"><input name="autoReceive" type="checkbox" defaultChecked={method?.autoReceive ?? false} /> Baixa automática</label>
        <label className="flex items-center gap-2"><input name="requiresAuthorization" type="checkbox" defaultChecked={method?.requiresAuthorization ?? false} /> Exige autorização</label>
      </div>
    </>
  );
}

export default async function AuxiliaryPage() {
  const [centers, accounts, methods] = await Promise.all([
    getCostCenters(),
    getFinancialAccounts(),
    getPaymentMethods(),
  ]);
  if (!centers.success || !accounts.success || !methods.success) {
    throw new Error(centers.error ?? accounts.error ?? methods.error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Opções auxiliares</h1>
        <p className="text-sm text-muted-foreground">Cadastros oficiais do domínio financeiro.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Centros de custo</h2>
          <form action={addCenter} className="my-3 grid gap-2">
            <input className="rounded border p-2" name="name" placeholder="Nome" required />
            <input className="rounded border p-2" name="code" placeholder="Código" />
            <button className="rounded bg-primary p-2 text-primary-foreground">Adicionar</button>
          </form>
          {(centers.data ?? []).map(center => <p className="border-t py-2 text-sm" key={center.id}>{center.code ? `${center.code} · ` : ''}{center.name}</p>)}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Plano de contas</h2>
          <form action={addAccount} className="my-3 grid gap-2">
            <input className="rounded border p-2" name="code" placeholder="Código" required />
            <input className="rounded border p-2" name="name" placeholder="Nome" required />
            <select className="rounded border p-2" name="type"><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></select>
            <button className="rounded bg-primary p-2 text-primary-foreground">Adicionar</button>
          </form>
          {(accounts.data ?? []).map(account => <p className="border-t py-2 text-sm" key={account.id}>{account.code} · {account.name}</p>)}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Formas de pagamento</h2>
          <form action={addMethod} className="my-3 grid gap-2 rounded-lg border border-dashed p-3">
            <PaymentFields />
            <button className="rounded bg-primary p-2 text-primary-foreground">Adicionar forma de pagamento</button>
          </form>
          <div className="space-y-3">
            {(methods.data ?? []).map(method => (
              <div className="rounded-lg border p-3" key={method.id}>
                <form action={editMethod} className="grid gap-2">
                  <input type="hidden" name="id" value={method.id} />
                  <PaymentFields method={method} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{method.isSystemDefault ? 'Padrão do sistema' : 'Personalizada'}</span>
                    <button className="rounded border px-3 py-2 text-sm font-medium hover:bg-slate-50">Salvar alterações</button>
                  </div>
                </form>
                {!method.isSystemDefault ? (
                  <form action={archiveMethod} className="mt-2 flex justify-end">
                    <input type="hidden" name="id" value={method.id} />
                    <button className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Excluir forma de pagamento</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
