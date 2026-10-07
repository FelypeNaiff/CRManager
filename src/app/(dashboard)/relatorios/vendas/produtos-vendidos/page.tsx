"use client"

import React, { useState, useEffect, useCallback } from "react"
import { PackageOpen, DollarSign, TrendingUp, Hash } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { getSoldProductsReportAction, SoldProductsFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function ProdutosVendidosReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: SoldProductsFilters = {
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
        searchQuery: searchQuery || undefined
      }

      const result = await getSoldProductsReportAction(filters)
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
  }, [startDate, endDate, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCsv = () => {
    if (!data || !data.items) return
    const headers = ["Cód. Interno", "Produto / Grade", "Quantidade", "Custo Médio", "Custo Total", "Valor Total", "Lucro"]
    const rows = data.items.map((i: any) => [
      i.codigo,
      i.nome,
      i.quantidade.toString(),
      i.custoMedio.toString(),
      i.custoTotal.toString(),
      i.valorTotal.toString(),
      i.lucro.toString()
    ])
    
    const csvContent = [
      headers.join(";"),
      ...rows.map((r: any) => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `produtos_vendidos_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Peças Vendidas", value: data.kpis.totalPecas.toString(), subtitle: "Quantidade no período", icon: Hash, colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Custo Total (CMV)", value: formatCurrency(data.kpis.custoTotalCmv), subtitle: "Soma do custo das peças", icon: PackageOpen, colorClass: "bg-rose-100 text-rose-600" },
    { title: "Valor de Venda", value: formatCurrency(data.kpis.valorTotalVendas), subtitle: "Faturamento gerado", icon: DollarSign, colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Lucro Total", value: formatCurrency(data.kpis.lucroTotal), subtitle: `Margem: ${data.kpis.margemGeral.toFixed(2)}%`, icon: TrendingUp, colorClass: "bg-blue-100 text-blue-600" },
  ] : []

  const columns = [
    { key: "codigo", header: "Cód. Interno" },
    { key: "nome", header: "Produto / Grade" },
    { key: "quantidade", header: "Quantidade", align: "center" as const },
    { 
      key: "custoMedio", 
      header: "Custo Médio", 
      align: "right" as const,
      render: (r: any) => formatCurrency(r.custoMedio)
    },
    { 
      key: "custoTotal", 
      header: "Custo Total", 
      align: "right" as const,
      render: (r: any) => formatCurrency(r.custoTotal)
    },
    { 
      key: "valorTotal", 
      header: "Valor Total", 
      align: "right" as const,
      render: (r: any) => <span className="font-semibold">{formatCurrency(r.valorTotal)}</span>
    },
    { 
      key: "lucro", 
      header: "Lucro (R$)", 
      align: "right" as const,
      render: (r: any) => (
        <span className={r.lucro >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
          {formatCurrency(r.lucro)}
        </span>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Relatório de Produtos Vendidos" 
        icon={PackageOpen} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={handleExportCsv}
      />

      <ReportAdvancedFilters 
        isOpen={showFilters} 
        onClear={() => { setStartDate(""); setEndDate(""); setSearchQuery(""); }} 
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
        <div className="space-y-2 lg:col-span-2">
          <label className="text-sm font-medium">Buscar Produto (Nome, Cód. Interno, SKU)</label>
          <Input placeholder="Digite para filtrar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
