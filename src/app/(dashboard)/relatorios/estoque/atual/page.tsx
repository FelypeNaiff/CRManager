"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Package, Search, DollarSign, TrendingUp, AlertTriangle } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStockPositionReportAction, StockPositionFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function PosiçaoEstoqueReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("TODOS")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: StockPositionFilters = {
        searchQuery: searchQuery || undefined,
        statusFilter: statusFilter as any
      }

      const result = await getStockPositionReportAction(filters)
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
  }, [searchQuery, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCsv = () => {
    if (!data || !data.items) return
    const headers = ["Cód. Interno", "Código de Barras", "Descrição", "Grade", "Estoque Atual", "Custo Unit", "Venda Unit", "Total Custo", "Total Venda", "Status"]
    const rows = data.items.map((i: any) => [
      i.internalCode,
      i.barcode || "",
      i.productName,
      i.variantName,
      i.currentStock.toString(),
      i.costPrice.toString(),
      i.salePrice.toString(),
      i.totalCost.toString(),
      i.totalSale.toString(),
      i.isLowStock ? "ESTOQUE BAIXO" : "OK"
    ])
    
    const csvContent = [
      headers.join(";"),
      ...rows.map((r: any) => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `posicao_estoque_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Total de Peças", value: data.kpis.totalPecas.toString(), subtitle: "Unidades físicas", icon: Package, colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Custo do Estoque", value: formatCurrency(data.kpis.totalCusto), subtitle: "Patrimônio parado", icon: DollarSign, colorClass: "bg-rose-100 text-rose-600" },
    { title: "Venda Projetada", value: formatCurrency(data.kpis.totalVenda), subtitle: `Margem Est.: ${data.kpis.margemPotencial.toFixed(2)}%`, icon: TrendingUp, colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Itens Críticos", value: data.kpis.itensCriticos.toString(), subtitle: "Abaixo do estoque mínimo", icon: AlertTriangle, colorClass: data.kpis.itensCriticos > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600" },
  ] : []

  const columns = [
    { key: "internalCode", header: "Cód. Interno" },
    { key: "productName", header: "Descrição do Produto" },
    { key: "variantName", header: "Grade / Tam" },
    { 
      key: "currentStock", 
      header: "Estoque", 
      align: "center" as const,
      render: (r: any) => (
        <span className={`font-semibold ${r.isLowStock ? 'text-red-600' : 'text-slate-700'}`}>
          {r.currentStock}
        </span>
      )
    },
    { 
      key: "costPrice", 
      header: "Custo Un.", 
      align: "right" as const,
      render: (r: any) => formatCurrency(r.costPrice)
    },
    { 
      key: "salePrice", 
      header: "Venda Un.", 
      align: "right" as const,
      render: (r: any) => formatCurrency(r.salePrice)
    },
    { 
      key: "totalCost", 
      header: "Total Custo", 
      align: "right" as const,
      render: (r: any) => formatCurrency(r.totalCost)
    },
    { 
      key: "totalSale", 
      header: "Total Venda", 
      align: "right" as const,
      render: (r: any) => <span className="font-semibold">{formatCurrency(r.totalSale)}</span>
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Posição Atual de Estoque" 
        icon={Package} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={handleExportCsv}
      />

      <ReportAdvancedFilters 
        isOpen={showFilters} 
        onClear={() => { setSearchQuery(""); setStatusFilter("TODOS"); }} 
        onApply={loadData}
      >
        <div className="space-y-2 lg:col-span-2">
          <label className="text-sm font-medium">Buscar (Nome, Cód. Interno, Barras)</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Digite para buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Status do Estoque</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todas as posições</SelectItem>
              <SelectItem value="APENAS_EM_ESTOQUE">Em Estoque (&gt; 0)</SelectItem>
              <SelectItem value="ESTOQUE_BAIXO">Estoque Baixo/Ruptura</SelectItem>
              <SelectItem value="ZERADOS">Zerados ou Negativos</SelectItem>
            </SelectContent>
          </Select>
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
