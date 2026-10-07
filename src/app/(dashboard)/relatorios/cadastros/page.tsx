"use client"

import React from "react"
import Link from "next/link"
import { Users, Gift, Briefcase } from "lucide-react"

export default function CadastrosReportsHub() {
  const cards = [
    { title: "Clientes", icon: Users, url: "/crm/clientes", color: "bg-emerald-500", desc: "Relatório de base de clientes" },
    { title: "Aniversariantes", icon: Gift, url: "/crm/clientes?tab=aniversariantes", color: "bg-orange-500", desc: "Listagem de aniversariantes" },
    { title: "Funcionários", icon: Briefcase, url: "/comercial/vendedores", color: "bg-slate-700", desc: "Colaboradores e vendedores" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-slate-800">Relatórios de Cadastros</h1>
        <p className="text-slate-500">Acesse listagens e dados mestres do sistema.</p>
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
