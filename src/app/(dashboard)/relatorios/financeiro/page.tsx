"use client"

import React from "react"
import Link from "next/link"
import { FileSpreadsheet, ArrowUpRight, ArrowDownLeft, BadgeDollarSign, BarChart3 } from "lucide-react"

export default function FinanceiroReportsHub() {
  const cards = [
    { title: "Extrato Financeiro", icon: FileSpreadsheet, url: "/financeiro/fluxo-caixa", color: "bg-blue-600", desc: "Movimentação de caixa diária" },
    { title: "Contas a Pagar", icon: ArrowUpRight, url: "/relatorios/financeiro/contas-a-pagar", color: "bg-rose-500", desc: "Despesas e obrigações" },
    { title: "Contas a Receber", icon: ArrowDownLeft, url: "/relatorios/financeiro/contas-a-receber", color: "bg-emerald-500", desc: "Receitas e boletos emitidos" },
    { title: "Comissão de Vendedores", icon: BadgeDollarSign, url: "/comercial/comissoes", color: "bg-indigo-500", desc: "Pagamento de comissionamentos" },
    { title: "DRE", icon: BarChart3, url: "/relatorios/financeiro/dre", color: "bg-purple-600", desc: "Demonstrativo do Resultado do Exercício" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-slate-800">Relatórios Financeiros</h1>
        <p className="text-slate-500">Fluxo de caixa, recebíveis, pagamentos e resultados (DRE).</p>
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
