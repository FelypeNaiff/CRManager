"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

const modules = [
  {
    name: "Dashboard",
    permissions: [
      "Visualizar dashboard geral",
      "Visualizar faturamento",
      "Visualizar lucro/margem",
      "Visualizar estoque crítico",
      "Visualizar indicadores financeiros",
    ],
  },
  {
    name: "CRM",
    permissions: [
      "Visualizar clientes",
      "Criar clientes",
      "Editar clientes",
      "Excluir clientes",
      "Exportar clientes",
      "Visualizar filhos",
      "Criar filhos",
      "Editar filhos",
      "Excluir filhos",
      "Visualizar atendimentos",
      "Criar atendimentos",
      "Editar atendimentos",
      "Finalizar atendimentos",
    ],
  },
  {
    name: "Estoque",
    permissions: [
      "Visualizar produtos",
      "Criar produtos",
      "Editar produtos",
      "Excluir produtos",
      "Exportar produtos",
      "Visualizar custo do produto",
      "Visualizar margem",
      "Alterar preço de venda",
      "Alterar preço de custo",
      "Visualizar estoque",
      "Fazer entrada de estoque",
      "Fazer saída de estoque",
      "Fazer ajuste de estoque",
      "Fazer inventário",
      "Imprimir etiquetas",
    ],
  },
  {
    name: "Vendas / PDV",
    permissions: [
      "Acessar PDV",
      "Criar venda",
      "Cancelar venda",
      "Aplicar desconto",
      "Aplicar desconto acima do limite",
      "Finalizar venda",
      "Reimprimir comprovante",
      "Visualizar vendas realizadas",
      "Cancelar venda realizada",
      "Realizar troca/devolução",
      "Visualizar comissão",
    ],
  },
  {
    name: "Financeiro",
    permissions: [
      "Visualizar financeiro",
      "Criar conta a pagar",
      "Editar conta a pagar",
      "Excluir conta a pagar",
      "Baixar conta a pagar",
      "Criar conta a receber",
      "Editar conta a receber",
      "Excluir conta a receber",
      "Baixar conta a receber",
      "Visualizar contas bancárias",
      "Criar movimentação bancária",
      "Excluir movimentação bancária",
      "Visualizar fluxo de caixa",
      "Visualizar lucro",
    ],
  },
  {
    name: "Relatórios",
    permissions: [
      "Visualizar relatórios",
      "Exportar PDF",
      "Exportar Excel",
      "Imprimir relatórios",
      "Relatórios de clientes",
      "Relatórios de estoque",
      "Relatórios de vendas",
      "Relatórios financeiros",
      "Relatórios gerenciais",
    ],
  },
  {
    name: "Marketing",
    permissions: [
      "Visualizar campanhas",
      "Criar campanhas",
      "Editar campanhas",
      "Excluir campanhas",
      "Enviar campanha",
      "Visualizar templates",
      "Criar templates",
      "Editar templates",
      "Excluir templates",
    ],
  },
  {
    name: "Comunicação",
    permissions: [
      "Visualizar conversas",
      "Enviar mensagens",
      "Enviar mensagens em massa",
      "Configurar WhatsApp",
      "Visualizar histórico de mensagens",
    ],
  },
  {
    name: "Agenda",
    permissions: [
      "Visualizar agenda",
      "Criar tarefa",
      "Editar tarefa",
      "Excluir tarefa",
      "Concluir tarefa",
      "Atribuir tarefa a outro usuário",
    ],
  },
  {
    name: "Configurações",
    permissions: [
      "Visualizar configurações",
      "Editar dados da loja",
      "Criar usuários",
      "Editar usuários",
      "Excluir usuários",
      "Alterar permissões",
      "Visualizar logs",
      "Configurar integrações",
    ],
  },
]

export default function ConfiguracoesPermissoesModuloPage() {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (permission: string) => {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permissões por Módulo</h1>
          <p className="mt-2 text-muted-foreground">Defina permissões específicas por módulo para cada perfil ou usuário.</p>
        </div>
        <Button className="bg-primary text-white">Salvar permissões</Button>
      </div>

      <div className="space-y-6">
        {modules.map((module) => (
          <section key={module.name} className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{module.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {module.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 rounded-md border p-3 hover:bg-slate-50 cursor-pointer">
                  <Checkbox checked={selected.includes(permission)} onCheckedChange={() => toggle(permission)} />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
