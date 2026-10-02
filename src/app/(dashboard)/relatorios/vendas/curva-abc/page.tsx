"use client"

import React, { useState, useEffect, useCallback } from "react"
import { TrendingUp, Target, ListOrdered, BarChart3, DollarSign } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { getProductAbcReportAction, SoldProductsFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function CurvaAbcReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: SoldProductsFilters = {
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
      }

      const result = await getProductAbcReportAction(filters)
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
    if (!data || !data.items) return
    const headers = ["Cód. Interno", "Descrição", "Qtd Vendida", "Faturamento", "% Part.", "% Acumulada", "Classe"]
    const rows = data.items.map((i: any) => [
      i.codigo,
      i.descricao,
      i.quantidade.toString(),
      i.faturamento.toString(),
      i.participacao.toFixed(2),
      i.acumulada.toFixed(2),
      i.classe
    ])
    
    const csvContent = [
      headers.join(";"),
      ...rows.map((r: any) => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `curva_abc_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Faturamento Considerado", value: formatCurrency(data.kpis.faturamentoTotal), subtitle: "Soma das vendas válidas", icon: DollarSign, colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Classe A (Até 80%)", value: data.kpis.classeA.toString(), subtitle: `${((data.kpis.classeA / data.kpis.totalItens) * 100 || 0).toFixed(1)}% do catálogo vendido`, icon: Target, colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Classe B (Até 95%)", value: data.kpis.classeB.toString(), subtitle: `${((data.kpis.classeB / data.kpis.totalItens) * 100 || 0).toFixed(1)}% do catálogo vendido`, icon: BarChart3, colorClass: "bg-amber-100 text-amber-600" },
    { title: "Classe C (Até 100%)", value: data.kpis.classeC.toString(), subtitle: `${((data.kpis.classeC / data.kpis.totalItens) * 100 || 0).toFixed(1)}% do catálogo vendido`, icon: ListOrdered, colorClass: "bg-slate-100 text-slate-600" },
  ] : []

  const columns = [
    { key: "codigo", header: "Cód. Interno" },
    { key: "descricao", header: "Produto / Grade" },
    { key: "quantidade", header: "Qtd.", align: "center" as const },
    { 
      key: "faturamento", 
      header: "Faturamento", 
      align: "right" as const,
      render: (r: any) => formatCurrency(r.faturamento)
    },
    { 
      key: "participacao", 
      header: "% Part.", 
      align: "right" as const,
      render: (r: any) => `${r.participacao.toFixed(2)}%`
    },
    { 
      key: "acumulada", 
      header: "% Acumulada", 
      align: "right" as const,
      render: (r: any) => <span className="font-semibold text-slate-700">{r.acumulada.toFixed(2)}%</span>
    },
    { 
      key: "classe", 
      header: "Classe ABC", 
      align: "center" as const,
      render: (r: any) => {
        let bg = "bg-slate-100 text-slate-700"
        if (r.classe === "A") bg = "bg-emerald-100 text-emerald-700"
        if (r.classe === "B") bg = "bg-amber-100 text-amber-700"
        
        return (
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${bg}`}>
            {r.classe}
          </span>
        )
      }
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Curva ABC de Produtos" 
        icon={TrendingUp} 
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

      <ReportTable 
        columns={columns} 
        data={data?.items || []} 
        isLoading={isLoading} 
      />
    </div>
  )
}


