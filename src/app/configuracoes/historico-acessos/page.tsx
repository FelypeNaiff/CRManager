export default function ConfiguracoesHistoricoAcessosPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Histórico de Acessos</h1>
        <p className="mt-2 text-muted-foreground">
          Registros de logins e tentativas de acesso ao sistema.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Informações coletadas</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <li>Usuário</li>
          <li>Data e hora do login</li>
          <li>IP</li>
          <li>Dispositivo</li>
          <li>Navegador</li>
          <li>Localização aproximada</li>
          <li>Status do login: sucesso / falha</li>
          <li>Motivo da falha</li>
        </ul>
      </section>
    </div>
  )
}
