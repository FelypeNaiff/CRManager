export default function ConfiguracoesHorariosPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Horários</h1>
        <p className="mt-2 text-muted-foreground">
          Controle dos períodos de funcionamento e horários especiais.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Campos</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <li>Dias funcionamento</li>
          <li>Hora abertura</li>
          <li>Hora fechamento</li>
          <li>Intervalo almoço</li>
          <li>Horário especial</li>
          <li>Feriados</li>
        </ul>
      </section>
    </div>
  )
}
