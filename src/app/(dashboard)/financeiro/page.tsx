import Link from 'next/link';
import { getFinancialDashboardSummary } from '@/lib/financial/financial-actions';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default async function FinanceiroDashboardPage() {
  const result = await getFinancialDashboardSummary();
  if (!result.success || !result.data) throw new Error(result.error ?? 'Erro ao carregar resumo financeiro.');
  const data = result.data;
  const cards = [
    ['Saldo em contas', money(data.totalBalance)],
    ['Entradas no mês', money(data.monthlyIncome)],
    ['Saídas no mês', money(data.monthlyExpense)],
    ['Resultado no mês', money(data.monthlyResult)],
    ['Recebíveis vencidos', `${data.overdueReceivables.count} · ${money(data.overdueReceivables.total)}`],
  ];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Financeiro</h1><p className="text-sm text-muted-foreground">Resumo real do tenant autenticado.</p></div>
    <div className="grid gap-4 md:grid-cols-3">{cards.map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-5"><h2 className="font-semibold">Contas ativas</h2><div className="mt-3 space-y-2">{data.bankAccounts.length ? data.bankAccounts.map(account => <div key={account.id} className="flex justify-between border-b py-2"><span>{account.name}</span><strong>{money(Number(account.currentBalance))}</strong></div>) : <p className="text-sm text-muted-foreground">Nenhuma conta ativa.</p>}</div></section>
      <section className="rounded-lg border bg-card p-5"><h2 className="font-semibold">Caixa atual</h2>{data.openCashRegister ? <div className="mt-3 text-sm"><p><strong>Conta:</strong> {data.openCashRegister.bankAccount.name}</p><p><strong>Aberto por:</strong> {data.openCashRegister.openedBy.name}</p><p><strong>Saldo inicial:</strong> {money(Number(data.openCashRegister.openingBalance))}</p></div> : <p className="mt-3 text-sm text-muted-foreground">Nenhum caixa aberto.</p>}<Link className="mt-4 inline-block text-sm text-primary underline" href="/financeiro/caixas">Gerenciar caixa</Link></section>
    </div>
  </div>;
}
