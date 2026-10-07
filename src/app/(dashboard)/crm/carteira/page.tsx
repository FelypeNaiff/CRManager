"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Wallet, Users, MessageCircle } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { getWalletsWithBalanceAction } from "@/lib/crm/crm-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function CarteiraReportPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getWalletsWithBalanceAction()
      if (result.success) {
        setData(result.data)
      } else {
        toast({ variant: "destructive", title: "Erro ao carregar", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro inesperado." })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Clientes com Saldo", value: data.kpis.totalClients.toString(), subtitle: "Possuem crédito ativo", icon: Users, colorClass: "bg-blue-100 text-blue-600" },
    { title: "Crédito Circulante (R$)", value: formatCurrency(data.kpis.totalCredit), subtitle: "Soma de todos os saldos", icon: Wallet, colorClass: "bg-emerald-100 text-emerald-600" },
  ] : []

  const columns = [
    { key: "customerName", header: "Nome do Cliente" },
    { 
      key: "whatsapp", 
      header: "WhatsApp",
      render: (r: any) => {
        if (!r.whatsapp) return <span className="text-slate-400">Sem número</span>
        const waLink = `https://wa.me/55${r.whatsapp.replace(/\D/g, '')}`
        return (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium">
            <MessageCircle className="h-4 w-4" />
            {r.whatsapp}
          </a>
        )
      }
    },
    { 
      key: "lastMovement", 
      header: "Última Movimentação",
      render: (r: any) => r.lastMovement ? format(new Date(r.lastMovement), "dd/MM/yyyy HH:mm") : "-" 
    },
    { 
      key: "balance", 
      header: "Saldo Atual", 
      align: "right" as const,
      render: (r: any) => <span className="font-semibold text-emerald-600">{formatCurrency(r.balance)}</span>
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Carteira / Saldo" 
        icon={Wallet} 
        onToggleFilters={() => {}}
        onExportCsv={() => {}}
      />

      <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm mb-4 border border-blue-100">
        Esta visão lista <strong>exclusivamente</strong> os clientes que possuem crédito (saldo em carteira / vale-troca) positivo ativo na loja.
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportKpiCards cards={kpis} />
        </div>
      )}

      <ReportTable 
        columns={columns} 
        data={data?.items || []} 
        isLoading={isLoading} 
      />
    </div>
  )
}
