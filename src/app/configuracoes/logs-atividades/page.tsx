export default function ConfiguracoesLogsAtividadesPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Logs de Atividades</h1>
        <p className="mt-2 text-muted-foreground">
          Registro de ações sensíveis executadas no sistema.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Campos do log</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <li>Usuário</li>
          <li>Ação</li>
          <li>Módulo</li>
          <li>Registro alterado</li>
          <li>Valor anterior</li>
          <li>Valor novo</li>
          <li>Data e hora</li>
          <li>IP</li>
          <li>Dispositivo</li>
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Exemplos: usuário criou cliente, editou produto, alterou preço, excluiu venda, cancelou venda, aplicou desconto, baixou conta a pagar, exportou relatório, alterou permissão, acessou dados financeiros.
        </p>
      </section>
    </div>
  )
}
