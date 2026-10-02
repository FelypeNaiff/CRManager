import Link from 'next/link';
import { getInventoryOverview } from '@/lib/inventory/inventory-actions';
import { InventoryOperations } from './inventory-operations';

export default async function EstoquePage() {
  const { warehouses, positions, sessions } = await getInventoryOverview();
  const physical = positions.reduce((sum: number, item: any) => sum + Number(item.physicalStock), 0);
  const reserved = positions.reduce((sum: number, item: any) => sum + Number(item.reservedStock), 0);
  return <main className="space-y-6 p-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm text-muted-foreground">Operação por depósito</p><h1 className="text-2xl font-semibold">Estoque</h1></div>
      <nav className="flex gap-2 text-sm"><Link className="rounded-md border px-3 py-2" href="/movimentacoes">Extrato</Link><Link className="rounded-md border px-3 py-2" href="/produtos/importar">Importar</Link></nav>
    </header>
    <section className="grid gap-3 sm:grid-cols-4">
      <Summary label="Depósitos ativos" value={warehouses.filter((item: any) => item.isActive).length} />
      <Summary label="Saldo físico" value={physical} />
      <Summary label="Reservado" value={reserved} />
      <Summary label="Disponível" value={physical - reserved} />
    </section>
    <InventoryOperations warehouses={warehouses as any} positions={positions as any} sessions={sessions as any} />
    <section className="rounded-lg border bg-card">
      <div className="border-b p-4"><h2 className="font-medium">Posições por depósito</h2><p className="text-sm text-muted-foreground">O disponível é sempre físico menos reservado.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Depósito</th><th className="p-3">Produto / variante</th><th className="p-3 text-right">Físico</th><th className="p-3 text-right">Reservado</th><th className="p-3 text-right">Disponível</th><th className="p-3 text-right">Versão</th></tr></thead>
        <tbody>{positions.map((item: any) => <tr className="border-b last:border-0" key={item.id}><td className="p-3">{item.warehouse.name}</td><td className="p-3">{item.variant.product.name} · {item.variant.name}</td><td className="p-3 text-right">{item.physicalStock}</td><td className="p-3 text-right">{item.reservedStock}</td><td className="p-3 text-right">{Number(item.physicalStock) - Number(item.reservedStock)}</td><td className="p-3 text-right">{item.version}</td></tr>)}</tbody>
      </table>{positions.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhuma posição registrada.</p>}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4"><h2 className="mb-3 font-medium">Depósitos</h2><ul className="space-y-2">{warehouses.map((item: any) => <li className="flex justify-between" key={item.id}><span>{item.name} <small className="text-muted-foreground">({item.code})</small></span><span className="text-xs">{item.isDefault ? 'Padrão' : item.isActive ? 'Ativo' : 'Inativo'}</span></li>)}</ul></div>
      <div className="rounded-lg border p-4"><h2 className="mb-3 font-medium">Inventários recentes</h2><ul className="space-y-2">{sessions.map((item: any) => <li className="flex justify-between" key={item.id}><span>{item.name} · {item.warehouse.name}</span><span className="text-xs">{item.status} · {item._count.items} itens</span></li>)}</ul>{sessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma contagem iniciada.</p>}</div>
    </section>
  </main>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value.toLocaleString('pt-BR')}</p></div>;
}
