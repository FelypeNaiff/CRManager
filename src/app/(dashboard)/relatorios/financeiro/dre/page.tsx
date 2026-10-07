"use client"

import React, { useState, useEffect, useCallback } from "react"
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { getDreReportAction, FinancialFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function DreReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: FinancialFilters = {
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
      }

      const result = await getDreReportAction(filters)
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
  }, [startDate, endDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCsv = () => {
    if (!data) return
    const lines = [
      ["Demonstrativo do Resultado do Exercício (DRE)"],
      [""],
      ["(+) Receita Operacional Bruta", data.receitaBruta.toString()],
      ["(-) Deduções da Receita", data.deducoes.toString()],
      ["(=) Receita Operacional Líquida", data.receitaLiquida.toString()],
      ["(-) Custo das Mercadorias Vendidas (CMV)", data.cmv.toString()],
      ["(=) Lucro Bruto (Margem de Contribuição)", data.lucroBruto.toString()],
      ["(-) Despesas Operacionais", data.totalDespesas.toString()],
    ]

    data.despesasDetalhadas.forEach((d: any) => {
      lines.push([`    ${d.name}`, d.amount.toString()])
    })

    lines.push(["(=) Lucro Líquido do Mês", data.lucroLiquido.toString()])

    const csvContent = lines.map(l => l.join(";")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `dre_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data ? [
    { title: "Receita Líquida", value: formatCurrency(data.receitaLiquida), icon: DollarSign, colorClass: "bg-blue-100 text-blue-600" },
    { title: "Margem Bruta", value: `${data.margemBruta.toFixed(2)}%`, icon: TrendingUp, colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Despesas Operacionais", value: formatCurrency(data.totalDespesas), icon: TrendingDown, colorClass: "bg-orange-100 text-orange-600" },
    { title: "Lucro Líquido", value: formatCurrency(data.lucroLiquido), subtitle: `Margem: ${data.margemLiquida.toFixed(2)}%`, icon: BarChart3, colorClass: data.lucroLiquido >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600" },
  ] : []

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="DRE - Demonstrativo do Resultado do Exercício" 
        icon={BarChart3} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={handleExportCsv}
      />

      <ReportAdvancedFilters 
        isOpen={showFilters} 
        onClear={() => { setStartDate(""); setEndDate(""); }} 
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
      </ReportAdvancedFilters>

      {kpis.length > 0 && <ReportKpiCards cards={kpis} />}

      {data && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-sm">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between font-semibold text-slate-800">
            <span>(+) Receita Operacional Bruta</span>
            <span>{formatCurrency(data.receitaBruta)}</span>
          </div>
          <div className="p-4 border-b border-slate-100 flex justify-between text-rose-600">
            <span>(-) Deduções da Receita (Descontos e Cancelamentos)</span>
            <span>{formatCurrency(data.deducoes)}</span>
          </div>
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between font-bold text-slate-800">
            <span>(=) Receita Operacional Líquida</span>
            <span>{formatCurrency(data.receitaLiquida)}</span>
          </div>
          <div className="p-4 border-b border-slate-100 flex justify-between text-orange-600">
            <span>(-) Custo das Mercadorias Vendidas (CMV)</span>
            <span>{formatCurrency(data.cmv)}</span>
          </div>
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between font-bold text-slate-800">
            <span>(=) Lucro Bruto (Margem de Contribuição)</span>
            <span>{formatCurrency(data.lucroBruto)}</span>
          </div>
          <div className="p-4 border-b border-slate-100 flex justify-between text-rose-600 font-semibold">
            <span>(-) Despesas Operacionais</span>
            <span>{formatCurrency(data.totalDespesas)}</span>
          </div>
          {data.despesasDetalhadas.map((d: any, idx: number) => (
            <div key={idx} className="px-8 py-2 border-b border-slate-50 flex justify-between text-slate-600 text-xs">
              <span>{d.name}</span>
              <span>{formatCurrency(d.amount)}</span>
            </div>
          ))}
          <div className={`p-5 flex justify-between font-headline font-bold text-lg ${data.lucroLiquido >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            <span>(=) Resultado Operacional Líquido</span>
            <span>{formatCurrency(data.lucroLiquido)}</span>
          </div>
        </div>
      )}
      
      {isLoading && !data && (
        <div className="text-center py-10 text-slate-500">Calculando demonstração...</div>
      )}
    </div>
  )
}
