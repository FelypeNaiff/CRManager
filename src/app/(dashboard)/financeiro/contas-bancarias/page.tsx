import { revalidatePath } from 'next/cache';
import { createBankAccount, deleteBankAccount, getBankAccounts } from '@/lib/financial/financial-actions';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

async function createAccount(formData: FormData) {
  'use server';
  await createBankAccount({ name: String(formData.get('name') ?? ''), bankName: String(formData.get('bankName') ?? '') || null, initialBalance: Number(formData.get('initialBalance') ?? 0), isCashAccount: formData.get('isCashAccount') === 'on' });
  revalidatePath('/financeiro/contas-bancarias');
}
async function archiveAccount(formData: FormData) {
  'use server';
  await deleteBankAccount(String(formData.get('id')));
  revalidatePath('/financeiro/contas-bancarias');
}

export default async function BankAccountsPage() {
  const result = await getBankAccounts();
  if (!result.success) throw new Error(result.error);
  const accounts = result.data ?? [];
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Contas bancárias</h1><p className="text-sm text-muted-foreground">Fonte oficial: BankAccount.</p></div>
    <form action={createAccount} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4"><input className="rounded border p-2" name="name" placeholder="Nome da conta" required /><input className="rounded border p-2" name="bankName" placeholder="Banco" /><input className="rounded border p-2" name="initialBalance" type="number" step="0.01" min="0" defaultValue="0" /><label className="flex items-center gap-2 text-sm"><input name="isCashAccount" type="checkbox" /> Conta caixa</label><button className="rounded bg-primary px-4 py-2 text-primary-foreground" type="submit">Criar conta</button></form>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="bg-muted"><th className="p-3 text-left">Conta</th><th className="p-3 text-left">Banco</th><th className="p-3 text-right">Saldo</th><th className="p-3">Ação</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id} className="border-t"><td className="p-3">{account.name}</td><td className="p-3">{account.bankName ?? '—'}</td><td className="p-3 text-right font-medium">{money(Number(account.currentBalance))}</td><td className="p-3 text-center"><form action={archiveAccount}><input type="hidden" name="id" value={account.id}/><button className="text-destructive underline">Inativar</button></form></td></tr>)}</tbody></table></div>
  </div>;
}
