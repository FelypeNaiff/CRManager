"use client"

import React, { useState, useEffect, useCallback } from "react"
import { FileSpreadsheet, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getFinancialStatementReportAction, FinancialFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function ExtratoFinanceiroReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [type, setType] = useState("ALL")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: FinancialFilters = {
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
        type: type !== "ALL" ? type : undefined
      }

      const result = await getFinancialStatementReportAction(filters)
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
  }, [startDate, endDate, type])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCsv = () => {
    if (!data || !data.statement) return
    const headers = ["Data", "Descrição", "Categoria", "Origem/Caixa", "Tipo", "Valor"]
    const rows = data.statement.map((i: any) => [
      format(new Date(i.date), "dd/MM/yyyy HH:mm"),
      i.description,
      i.category,
      i.origin,
      i.type,
      i.amount.toString()
    ])
    
    const csvContent = [
      headers.join(";"),
      ...rows.map((r: any) => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `extrato_financeiro_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Total de Entradas", value: formatCurrency(data.kpis.totalEntradas), icon: ArrowUpCircle, colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Total de Saídas", value: formatCurrency(data.kpis.totalSaidas), icon: ArrowDownCircle, colorClass: "bg-rose-100 text-rose-600" },
    { title: "Saldo no Período", value: formatCurrency(data.kpis.saldoAtual), subtitle: "Entradas - Saídas", icon: Wallet, colorClass: data.kpis.saldoAtual >= 0 ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600" },
  ] : []

  const columns = [
    { 
      key: "date", 
      header: "Data/Hora", 
      render: (r: any) => format(new Date(r.date), "dd/MM/yyyy HH:mm") 
    },
    { key: "description", header: "Descrição" },
    { key: "category", header: "Categoria" },
    { key: "origin", header: "Origem/Caixa" },
    { 
      key: "type", 
      header: "Tipo",
      align: "center" as const,
      render: (r: any) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${r.type === 'ENTRADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {r.type}
        </span>
      )
    },
    { 
      key: "amount", 
      header: "Valor (R$)", 
      align: "right" as const,
      render: (r: any) => (
        <span className={r.type === 'ENTRADA' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
          {r.type === 'SAIDA' ? '- ' : '+ '}{formatCurrency(r.amount)}
        </span>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Extrato Financeiro Consolidado" 
        icon={FileSpreadsheet} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={handleExportCsv}
      />

      <ReportAdvancedFilters 
        isOpen={showFilters} 
        onClear={() => { setStartDate(""); setEndDate(""); setType("ALL"); }} 
        onApply={loadData}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Data Inicial</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Data Final</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de Movimentação</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Movimentações</SelectItem>
              <SelectItem value="INCOME">Entradas (Receitas/Vendas)</SelectItem>
              <SelectItem value="EXPENSE">Saídas (Despesas/Vales)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ReportAdvancedFilters>

      {kpis.length > 0 && <ReportKpiCards cards={kpis} />}

      <ReportTable 
        columns={columns} 
        data={data?.statement || []} 
        isLoading={isLoading} 
      />
    </div>
  )
}
