"use client"

import React from "react"
import Link from "next/link"
import { ShoppingCart, PackageOpen, Tag, Repeat, Box, TrendingUp, DollarSign, Award, FileText } from "lucide-react"

export default function VendasReportsHub() {
  const cards = [
    { title: "Relatório de Vendas", icon: ShoppingCart, url: "/relatorios/vendas/geral", color: "bg-indigo-500", desc: "Listagem detalhada das vendas efetuadas" },
    { title: "Produtos Vendidos", icon: PackageOpen, url: "/relatorios/vendas/produtos-vendidos", color: "bg-indigo-400", desc: "Agrupamento por produto vendido" },
    { title: "Itens Vendidos", icon: Tag, url: "/relatorios/vendas/itens-vendidos", color: "bg-indigo-300", desc: "Histórico item a item" },
    { title: "Relatório de Devoluções", icon: Repeat, url: "/relatorios/vendas/devolucoes", color: "bg-rose-500", desc: "Vendas canceladas e estornos" },
    { title: "Produtos Devolvidos", icon: Box, url: "/relatorios/vendas/produtos-devolvidos", color: "bg-rose-400", desc: "Controle de retorno ao estoque" },
    { title: "Curva ABC", icon: TrendingUp, url: "/relatorios/vendas/curva-abc", color: "bg-emerald-500", desc: "Produtos e Clientes mais rentáveis" },
    { title: "Clientes que Mais Compram", icon: Award, url: "/relatorios/vendas/top-clientes", color: "bg-amber-500", desc: "Ranking de fidelidade" },
    { title: "Comissões", icon: DollarSign, url: "/comercial/comissoes", color: "bg-blue-500", desc: "Comissão por venda e produto" },
    { title: "Orçamentos", icon: FileText, url: "/comercial/orcamentos", color: "bg-slate-500", desc: "Propostas e orçamentos emitidos" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-slate-800">Relatórios de Vendas</h1>
        <p className="text-slate-500">Métricas comerciais, devoluções e análises de desempenho.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => {
          const Icon = c.icon
          return (
            <Link key={i} href={c.url} className="group flex items-start gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer">
              <div className={`p-4 rounded-xl text-white shadow-sm ${c.color} group-hover:scale-105 transition-transform`}>
                <Icon className="h-8 w-8" />
              </div>
              <div className="pt-1">
                <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{c.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
