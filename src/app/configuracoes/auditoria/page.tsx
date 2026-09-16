import Link from 'next/link';
import { requirePermission } from '@/lib/auth/permissions';
import { getActivityLogs, type ActivityLogFilters } from '@/lib/auth/audit-log-actions';
import { auditActionLabel } from '@/lib/auth/audit-display';

function fieldLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
}

function MetadataView({ metadata }: { metadata: any }) {
  if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) return <span className="text-slate-500">Sem detalhes adicionais.</span>;
  if (metadata.changes && typeof metadata.changes === 'object') {
    return <div className="grid gap-2">{Object.entries(metadata.changes).map(([field, change]: any) => (
      <div key={field}><strong>{fieldLabel(field)}:</strong> {String(change?.before ?? '—')} → {String(change?.after ?? '—')}</div>
    ))}</div>;
  }
  return <div className="grid gap-1">{Object.entries(metadata).map(([key, value]) => (
    <div key={key}><strong>{fieldLabel(key)}:</strong> {typeof value === 'object' ? <pre className="mt-1 overflow-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(value, null, 2)}</pre> : String(value ?? '—')}</div>
  ))}</div>;
}

function pageHref(params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, value]) => value) as [string, string][]);
  return `/configuracoes/auditoria?${query}`;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission('LOGS', 'VIEW');
  const params = await searchParams;
  const filters: ActivityLogFilters = { ...params, page: Number(params.page), pageSize: 25 };
  const result = await getActivityLogs(filters);

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-16">
    <div><h1 className="text-2xl font-bold">Auditoria</h1><p className="text-sm text-slate-500">Trilha oficial de ações do NEEX.</p></div>
    <form className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
      <input className="rounded border p-2" type="date" name="startDate" defaultValue={params.startDate} aria-label="Data inicial" />
      <input className="rounded border p-2" type="date" name="endDate" defaultValue={params.endDate} aria-label="Data final" />
      <select className="rounded border p-2" name="actorUserId" defaultValue={params.actorUserId ?? ''}><option value="">Todos os atores</option>{result.users.map(user => <option key={user.id} value={user.id}>{user.name}{user.role?.name ? ` — ${user.role.name}` : ''}</option>)}</select>
      <select className="rounded border p-2" name="authenticatedUserId" defaultValue={params.authenticatedUserId ?? ''}><option value="">Todas as contas autenticadas</option>{result.users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
      <select className="rounded border p-2" name="module" defaultValue={params.module ?? ''}><option value="">Todos os módulos</option>{result.modules.map(value => <option key={value}>{value}</option>)}</select>
      <select className="rounded border p-2" name="action" defaultValue={params.action ?? ''}><option value="">Todas as ações</option>{result.actions.map(value => <option key={value} value={value}>{auditActionLabel(value)}</option>)}</select>
      <input className="rounded border p-2" name="recordId" defaultValue={params.recordId} placeholder="ID do registro" />
      <input className="rounded border p-2" name="search" defaultValue={params.search} placeholder="Buscar no resumo" maxLength={100} />
      <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">Aplicar filtros</button>
      <Link className="rounded border px-4 py-2 text-center" href="/configuracoes/auditoria">Limpar</Link>
    </form>

    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-[1100px] w-full text-sm"><thead className="bg-slate-50 text-left"><tr>{['Data/hora', 'Ator', 'Conta autenticada', 'Ação', 'Módulo', 'Registro', 'Resumo'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead>
        <tbody>{result.logs.length === 0 ? <tr><td className="p-8 text-center text-slate-500" colSpan={7}>Nenhum evento encontrado.</td></tr> : result.logs.map(log => {
          const direct = log.actorUserId === log.authenticatedUserId;
          return <tr key={log.id} className="border-t align-top">
            <td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(log.createdAt)}</td>
            <td className="p-3 font-medium">{log.actorUser.name}<div className="text-xs text-slate-500">{log.actorUser.role?.name}</div></td>
            <td className="p-3">{direct ? <span className="text-slate-500">Acesso direto</span> : log.authenticatedUser.name}</td>
            <td className="p-3">{auditActionLabel(log.action)}</td><td className="p-3">{log.module}</td><td className="p-3 font-mono text-xs">{log.recordId ?? '—'}</td>
            <td className="max-w-md p-3"><div>{log.details ?? '—'}</div><details className="mt-2"><summary className="cursor-pointer text-blue-700">Ver detalhes</summary><div className="mt-2 rounded border p-3"><MetadataView metadata={log.metadata} /></div></details></td>
          </tr>;
        })}</tbody></table>
    </div>
    <div className="flex items-center justify-between text-sm"><span>{result.pagination.total} evento(s) — página {result.pagination.page} de {result.pagination.totalPages}</span><div className="flex gap-2">
      {result.pagination.page > 1 && <Link className="rounded border px-3 py-2" href={pageHref(params, result.pagination.page - 1)}>Anterior</Link>}
      {result.pagination.page < result.pagination.totalPages && <Link className="rounded border px-3 py-2" href={pageHref(params, result.pagination.page + 1)}>Próxima</Link>}
    </div></div>
  </div>;
}
