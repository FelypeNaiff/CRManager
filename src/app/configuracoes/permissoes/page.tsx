import Link from "next/link"

export default function PermissoesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/configuracoes" className="hover:underline">Configurações</Link> / Permissões
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Permissões</h1>
        <p className="text-muted-foreground">Gerencie a matriz de acesso por módulos do ERP.</p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-sm">
        Módulo em desenvolvimento...
      </div>
    </div>
  )
}
