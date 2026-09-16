import { revalidatePath } from 'next/cache';
import { cancelReceivable, getAccountsReceivable, payInstallment } from '@/lib/financial/accounts-receivable-service';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
async function pay(formData: FormData) { 'use server'; await payInstallment(String(formData.get('id')), { amount: Number(formData.get('amount')), paidAt: new Date().toISOString() }); revalidatePath('/financeiro/contas-a-receber'); }
async function cancel(formData: FormData) { 'use server'; await cancelReceivable(String(formData.get('id')), String(formData.get('reason') ?? 'Cancelamento administrativo')); revalidatePath('/financeiro/contas-a-receber'); }

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const result = await getAccountsReceivable({ status: params.status || undefined, startDueDate: params.startDate, endDueDate: params.endDate });
  if (!result.success) throw new Error(result.error);
  const rows = result.data ?? [];
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Contas a receber</h1><p className="text-sm text-muted-foreground">Recebíveis reais, com baixa e cancelamento auditados.</p></div>
    <form className="flex flex-wrap gap-3 rounded-lg border p-4"><select className="rounded border p-2" name="status" defaultValue={params.status ?? ''}><option value="">Todos os status</option>{['PENDING','PARTIAL','PAID','OVERDUE','CANCELLED','RENEGOTIATED'].map(v=><option key={v}>{v}</option>)}</select><input className="rounded border p-2" type="date" name="startDate" defaultValue={params.startDate}/><input className="rounded border p-2" type="date" name="endDate" defaultValue={params.endDate}/><button className="rounded bg-primary px-4 text-primary-foreground">Filtrar</button></form>
    <div className="overflow-x-auto rounded-lg border"><table className="min-w-[900px] w-full text-sm"><thead><tr className="bg-muted">{['Vencimento','Cliente','Parcela','Original','Saldo','Status','Operações'].map(h=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map(item=><tr key={item.id} className="border-t"><td className="p-3">{new Date(item.dueDate).toLocaleDateString('pt-BR')}</td><td className="p-3">{item.customer?.name ?? 'Sem cliente'}</td><td className="p-3">{item.installmentNumber}/{item.totalInstallments}</td><td className="p-3">{money(Number(item.originalAmount))}</td><td className="p-3">{money(Number(item.remainingAmount))}</td><td className="p-3">{item.status}</td><td className="p-3"><div className="flex gap-2">{!['PAID','CANCELLED'].includes(item.status)&&<><form action={pay} className="flex gap-1"><input type="hidden" name="id" value={item.id}/><input className="w-24 rounded border p-1" name="amount" type="number" step="0.01" min="0.01" max={Number(item.remainingAmount)} defaultValue={Number(item.remainingAmount)} required/><button className="text-primary underline">Baixar</button></form><form action={cancel}><input type="hidden" name="id" value={item.id}/><button className="text-destructive underline">Cancelar</button></form></>}</div></td></tr>)}</tbody></table></div>
  </div>;
}
