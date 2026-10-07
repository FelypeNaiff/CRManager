import Link from 'next/link';
import { getInventoryLedger, getInventoryOverview } from '@/lib/inventory/inventory-actions';

export default async function MovimentacoesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page ?? 1));
  const [{ warehouses, positions }, ledger] = await Promise.all([
    getInventoryOverview(),
    getInventoryLedger({ warehouseId: query.warehouse, variantId: query.variant, type: query.type, origin: query.origin, document: query.document, from: query.from ? new Date(`${query.from}T00:00:00`) : undefined, to: query.to ? new Date(`${query.to}T23:59:59.999`) : undefined, page, pageSize: 25 }),
  ]);
  const variants = Array.from(new Map(positions.map((item: any) => [item.variantId, item])).values()) as any[];
  const pages = Math.max(1, Math.ceil(ledger.total / ledger.pageSize));
  const pageHref = (target: number) => `/movimentacoes?${new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)), page: String(target) } as Record<string, string>)}`;
  return <main className="space-y-5 p-6">
    <header><p className="text-sm text-muted-foreground">Histórico físico reconciliável</p><h1 className="text-2xl font-semibold">Extrato de estoque</h1></header>
    <form className="grid gap-2 rounded-lg border p-4 md:grid-cols-4 xl:grid-cols-8">
      <select className="rounded border p-2 text-sm" name="warehouse" defaultValue={query.warehouse ?? ''}><option value="">Todos os depósitos</option>{warehouses.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="rounded border p-2 text-sm" name="variant" defaultValue={query.variant ?? ''}><option value="">Todas as variantes</option>{variants.map(item => <option key={item.variantId} value={item.variantId}>{item.variant.product.name} · {item.variant.name}</option>)}</select>
      <select className="rounded border p-2 text-sm" name="type" defaultValue={query.type ?? ''}><option value="">Todos os tipos</option>{['INITIAL','PURCHASE','SALE','RETURN','EXCHANGE','LOSS','DAMAGE','MANUAL_ADJUSTMENT','TRANSFER','RESERVATION','CANCELLATION'].map(type => <option key={type}>{type}</option>)}</select>
      <input className="rounded border p-2 text-sm" name="origin" defaultValue={query.origin} placeholder="Origem" />
      <input className="rounded border p-2 text-sm" name="document" defaultValue={query.document} placeholder="Documento" />
      <input className="rounded border p-2 text-sm" name="from" defaultValue={query.from} type="date" />
      <input className="rounded border p-2 text-sm" name="to" defaultValue={query.to} type="date" />
      <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">Filtrar</button>
    </form>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Data</th><th className="p-3">Depósito</th><th className="p-3">Produto</th><th className="p-3">Origem</th><th className="p-3 text-right">Anterior</th><th className="p-3 text-right">Entrada</th><th className="p-3 text-right">Saída</th><th className="p-3 text-right">Final</th><th className="p-3">Documento</th></tr></thead><tbody>{ledger.rows.map((row: any) => <tr className="border-b last:border-0" key={row.id}><td className="p-3 whitespace-nowrap">{new Date(row.occurredAt).toLocaleString('pt-BR')}</td><td className="p-3">{row.warehouse.name}</td><td className="p-3">{row.variant.product.name} · {row.variant.name}</td><td className="p-3">{row.origin}</td><td className="p-3 text-right">{row.balanceBefore}</td><td className="p-3 text-right text-green-700">{row.entry}</td><td className="p-3 text-right text-red-700">{row.exit}</td><td className="p-3 text-right font-medium">{row.balanceAfter}</td><td className="p-3">{row.documentType ?? '—'} {row.documentId ?? ''}</td></tr>)}</tbody></table>{ledger.rows.length === 0 && <p className="p-8 text-center text-muted-foreground">Nenhum movimento encontrado.</p>}</div>
    <footer className="flex items-center justify-between text-sm"><span>{ledger.total} resultado(s)</span><div className="flex items-center gap-2"><Link aria-disabled={page <= 1} className="rounded border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50" href={pageHref(page - 1)}>Anterior</Link><span>{page} / {pages}</span><Link aria-disabled={page >= pages} className="rounded border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50" href={pageHref(page + 1)}>Próxima</Link></div></footer>
  </main>;
}
