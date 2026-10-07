"use client"

import React from "react"
import Link from "next/link"
import { PackageSearch, ClipboardList, ShoppingBag, Box, Calculator } from "lucide-react"

export default function EstoqueReportsHub() {
  const cards = [
    { title: "Estoque Atual", icon: PackageSearch, url: "/relatorios/estoque/atual", color: "bg-teal-500", desc: "Posição atual de saldos" },
    { title: "Inventário", icon: ClipboardList, url: "/relatorios/estoque/inventario", color: "bg-teal-600", desc: "Contagem e auditoria" },
    { title: "Compras", icon: ShoppingBag, url: "/relatorios/estoque/compras", color: "bg-cyan-500", desc: "Histórico de NFs de entrada" },
    { title: "Produtos Comprados", icon: Box, url: "/relatorios/estoque/produtos-comprados", color: "bg-cyan-600", desc: "Análise por item comprado" },
    { title: "Cotações", icon: Calculator, url: "/relatorios/estoque/cotacoes", color: "bg-slate-500", desc: "Cotações com fornecedores" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-slate-800">Relatórios de Estoque</h1>
        <p className="text-slate-500">Acompanhamento de saldo físico, compras e inventários.</p>
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
