export default function ConfiguracoesIntegracoesPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="mt-2 text-muted-foreground">
          Configurações de integração e conectores externos.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">WhatsApp</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <li>Token API</li>
          <li>Número conectado</li>
          <li>Webhook</li>
          <li>Status conexão</li>
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">E-mail</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <li>SMTP host</li>
          <li>Porta</li>
          <li>E-mail envio</li>
          <li>Senha</li>
          <li>SSL/TLS</li>
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">APIs futuras</h2>
        <ul className="mt-4 text-sm text-slate-600 list-disc pl-5">
          <li>Google Calendar</li>
          <li>Mercado Livre</li>
          <li>Shopee</li>
          <li>Instagram</li>
          <li>Meta Ads</li>
          <li>Google Analytics</li>
        </ul>
      </section>
    </div>
  )
}
