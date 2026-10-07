'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveInventoryAction, createStockAdjustmentAction, createStockTransferAction, createWarehouseAction, saveInventoryCountAction, startInventoryAction } from '@/lib/inventory/inventory-actions';

type Warehouse = { id: string; name: string; isActive: boolean };
type Position = { warehouseId: string; variantId: string; version: number; variant: { name: string; product: { name: string } } };
type Session = { id: string; name: string; status: string; warehouse: { name: string }; items: { id: string; countedQuantity: string | null; referencePhysical: string; variant: { name: string; product: { name: string } } }[] };

export function InventoryOperations({ warehouses, positions, sessions }: { warehouses: Warehouse[]; positions: Position[]; sessions: Session[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const active = warehouses.filter(item => item.isActive);
  const variants = Array.from(new Map(positions.map(item => [item.variantId, item])).values());
  const submit = (operation: () => Promise<unknown>) => start(async () => {
    setMessage('');
    try { await operation(); setMessage('Operação concluída.'); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.'); }
  });

  return <section className="space-y-3">
    <div className="grid gap-3 xl:grid-cols-4">
      <form className="space-y-2 rounded-lg border p-4" action={form => submit(() => createWarehouseAction({ code: String(form.get('code')), name: String(form.get('name')) }))}>
        <h2 className="font-medium">Novo depósito</h2><Field name="code" label="Código" /><Field name="name" label="Nome" /><Submit pending={pending}>Cadastrar</Submit>
      </form>
      <form className="space-y-2 rounded-lg border p-4" action={form => submit(() => createStockAdjustmentAction({ warehouseId: String(form.get('warehouse')), variantId: String(form.get('variant')), kind: String(form.get('kind')) as 'DELTA'|'TARGET', quantity: String(form.get('quantity')), expectedVersion: Number(form.get('version')), reason: String(form.get('reason')) }))}>
        <h2 className="font-medium">Ajustar estoque</h2><Select name="warehouse" label="Depósito" items={active} /><VariantSelect positions={variants} /><select className="w-full rounded border p-2 text-sm" name="kind"><option value="DELTA">Acréscimo/retirada</option><option value="TARGET">Saldo-alvo</option></select><Field name="quantity" label="Quantidade" type="number" /><Field name="version" label="Versão observada" type="number" /><Field name="reason" label="Motivo" /><Submit pending={pending}>Confirmar ajuste</Submit>
      </form>
      <form className="space-y-2 rounded-lg border p-4" action={form => submit(() => createStockTransferAction({ fromWarehouseId: String(form.get('from')), toWarehouseId: String(form.get('to')), items: [{ variantId: String(form.get('variant')), quantity: String(form.get('quantity')) }], reason: String(form.get('reason')) }))}>
        <h2 className="font-medium">Transferência imediata</h2><Select name="from" label="Origem" items={active} /><Select name="to" label="Destino" items={active} /><VariantSelect positions={variants} /><Field name="quantity" label="Quantidade" type="number" /><Field name="reason" label="Motivo" /><Submit pending={pending}>Transferir</Submit>
      </form>
      <form className="space-y-2 rounded-lg border p-4" action={form => submit(() => startInventoryAction({ warehouseId: String(form.get('warehouse')), name: String(form.get('name')), variantIds: form.getAll('variants').map(String) }))}>
        <h2 className="font-medium">Inventário físico</h2><Select name="warehouse" label="Depósito" items={active} /><Field name="name" label="Nome da sessão" /><label className="block text-xs text-muted-foreground">Variantes</label><select className="min-h-24 w-full rounded border p-2 text-sm" name="variants" multiple required>{variants.map(item => <option key={item.variantId} value={item.variantId}>{item.variant.product.name} · {item.variant.name}</option>)}</select><Submit pending={pending}>Iniciar contagem</Submit>
      </form>
    </div>
    {message && <p className="rounded border p-3 text-sm" role="status">{message}</p>}
    {sessions.filter(session => session.status === 'COUNTING').map(session => <form key={session.id} className="rounded-lg border p-4" action={form => submit(async () => {
      for (const item of session.items) await saveInventoryCountAction({ sessionId: session.id, itemId: item.id, quantity: String(form.get(item.id)) });
    })}><div className="mb-3 flex items-center justify-between"><div><h2 className="font-medium">{session.name}</h2><p className="text-xs text-muted-foreground">{session.warehouse.name} · contagem não altera saldo</p></div></div><div className="grid gap-2 md:grid-cols-3">{session.items.map(item => <label className="text-xs text-muted-foreground" key={item.id}>{item.variant.product.name} · {item.variant.name} (ref. {item.referencePhysical})<input className="mt-1 w-full rounded border p-2 text-sm text-foreground" defaultValue={item.countedQuantity ?? ''} name={item.id} type="number" step="0.01" required /></label>)}</div><div className="mt-3 flex gap-2"><Submit pending={pending}>Salvar contagem</Submit><button className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={pending} formAction={() => submit(() => approveInventoryAction(session.id))}>Aprovar e aplicar</button></div></form>)}
  </section>;
}

function Field({ name, label, type = 'text' }: { name: string; label: string; type?: string }) { return <label className="block text-xs text-muted-foreground">{label}<input className="mt-1 w-full rounded border p-2 text-sm text-foreground" name={name} type={type} step={type === 'number' ? '0.01' : undefined} required /></label>; }
function Select({ name, label, items }: { name: string; label: string; items: Warehouse[] }) { return <label className="block text-xs text-muted-foreground">{label}<select className="mt-1 w-full rounded border p-2 text-sm text-foreground" name={name} required>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>; }
function VariantSelect({ positions }: { positions: Position[] }) { return <label className="block text-xs text-muted-foreground">Variante<select className="mt-1 w-full rounded border p-2 text-sm text-foreground" name="variant" required>{positions.map(item => <option key={item.variantId} value={item.variantId}>{item.variant.product.name} · {item.variant.name}</option>)}</select></label>; }
function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) { return <button className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">{pending ? 'Processando…' : children}</button>; }
