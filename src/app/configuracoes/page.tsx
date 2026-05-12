import Link from "next/link"

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Configurações</p>
            <h1 className="text-3xl font-bold">Painel de administração</h1>
            <p className="mt-2 text-muted-foreground">
              Acesse configurações de usuários, empresa e certificados em um painel organizado por categorias.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/configuracoes/usuarios?tab=usuarios"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Usuários
            </Link>
            <Link
              href="/configuracoes/empresa?tab=dados-gerais"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dados da Empresa
            </Link>
            <Link
              href="/configuracoes/certificado-digital"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Certificado Digital
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Usuários</h2>
          <p className="mt-2 text-sm text-slate-600">Gerencie usuários, perfis, permissões e auditoria de acesso.</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li><Link className="text-primary hover:underline" href="/configuracoes/usuarios?tab=usuarios">Usuários</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/usuarios?tab=perfis">Perfis de Acesso</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/usuarios?tab=permissoes">Permissões por Módulo</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/usuarios?tab=historico">Histórico de Acessos</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/usuarios?tab=logs">Logs de Atividades</Link></li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Dados da Empresa</h2>
          <p className="mt-2 text-sm text-slate-600">Ajuste informações corporativas, fiscais e operacionais.</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=dados-gerais">Dados Gerais</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=enderecos">Endereços</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=contatos">Contatos</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=financeiro-fiscal">Financeiro/Fiscal</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=branding">Branding</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=configuracoes-operacionais">Configurações Operacionais</Link></li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Operacional</h2>
          <p className="mt-2 text-sm text-slate-600">Controle integrações, horários e filiais do sistema.</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=integracoes">Integrações</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=horarios">Horários</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/empresa?tab=filiais">Filiais</Link></li>
            <li><Link className="text-primary hover:underline" href="/configuracoes/certificado-digital">Certificado Digital</Link></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
