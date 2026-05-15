export default function ConfiguracoesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Configurações</p>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Bem-vindo ao painel central de configurações do sistema.</p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-sm">
        Selecione uma categoria no menu lateral para visualizar ou editar suas preferências.
      </div>
    </div>
  )
}
