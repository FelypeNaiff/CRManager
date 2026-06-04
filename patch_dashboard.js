const fs = require('fs');

const content = `"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Baby, Wallet, TrendingUp, Sparkles, MessageSquare, Loader2, Calendar } from "lucide-react"
import { getCustomers, getActivityLogs, getSegmentationData } from "@/lib/crm/actions"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

export default function CrmDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalClientes: 0,
    clientesVip: 0,
    totalFilhos: 0,
    saldoCarteiras: 0,
    ticketMedioGlobal: 0
  })
  
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [segmentationRes] = await Promise.all([
          getSegmentationData(),
        ])

        if (segmentationRes.success && segmentationRes.data) {
          const { clientes, stats } = segmentationRes.data
          let totalFilhos = 0
          let saldoTotal = 0
          let totalTicket = 0

          clientes.forEach((c: any) => {
            const st = stats[c.id]
            if (st) {
              totalFilhos += st.filhos.length
              saldoTotal += st.saldoDisponivel
              totalTicket += st.ticketMedio
            }
          })

          setMetrics({
            totalClientes: clientes.length,
            clientesVip: clientes.filter((c: any) => c.vip).length,
            totalFilhos,
            saldoCarteiras: saldoTotal,
            ticketMedioGlobal: clientes.length > 0 ? totalTicket / clientes.length : 0
          })
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-muted-foreground text-sm font-medium">Carregando métricas do CRM...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-indigo-600" /> Dashboard CRM
        </h1>
        <p className="text-muted-foreground text-sm">Visão geral do seu relacionamento com o cliente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-indigo-800">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{metrics.totalClientes}</div>
            <p className="text-xs text-slate-500 font-medium mt-1">Base ativa cadastrada</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-emerald-800">Saldo Circulante</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">
              R$ {metrics.saldoCarteiras.toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Soma de carteiras</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-gradient-to-br from-pink-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-pink-800">Total Filhos</CardTitle>
            <Baby className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{metrics.totalFilhos}</div>
            <p className="text-xs text-slate-500 font-medium mt-1">Vínculos registrados</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-amber-800">Ticket Médio (CRM)</CardTitle>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">
              R$ {metrics.ticketMedioGlobal.toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Com base no histórico</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Resumo de Segmentação</CardTitle>
            <CardDescription>Acesse o painel de segmentações para criar campanhas detalhadas.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-center py-10 bg-slate-50 rounded-lg border">
                <p className="text-slate-500 text-sm">Gráficos de vendas foram migrados para o Dashboard Principal do PDV.</p>
             </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
`;

fs.writeFileSync('src/app/(dashboard)/crm/dashboard/page.tsx', content, 'utf8');
