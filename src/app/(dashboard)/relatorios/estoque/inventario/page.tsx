"use client"

import React, { useState, useEffect, useCallback } from "react"
import { ClipboardList, ArrowDownCircle, ArrowUpCircle, CheckCircle2 } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { getInventoryAuditsReportAction, InventoryAuditFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function InventarioReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: InventoryAuditFilters = {
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
      }

      const result = await getInventoryAuditsReportAction(filters)
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
    if (!data || !data.sessions) return
    const headers = ["Data", "Nome da Contagem", "Status", "Total de Itens", "Esperado", "Faltantes", "Sobrantes", "Valor Faltante", "Valor Sobrante", "Acuracidade %"]
    const rows = data.sessions.map((i: any) => [
      format(new Date(i.date), "dd/MM/yyyy HH:mm"),
      i.name,
      i.status,
      i.itemsCount.toString(),
      i.pecasEsperadas.toString(),
      i.pecasFaltantes.toString(),
      i.pecasSobrantes.toString(),
      i.valorFaltante.toString(),
      i.valorSobrante.toString(),
      i.acuracidade.toFixed(2)
    ])
    
    const csvContent = [
      headers.join(";"),
      ...rows.map((r: any) => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `inventario_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Peças Auditadas", value: data.kpis.globalAuditados.toString(), subtitle: "Qtd. Total Esperada", icon: ClipboardList, colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Quebra (Faltantes)", value: formatCurrency(data.kpis.globalFaltantesRs), subtitle: "Custo das perdas", icon: ArrowDownCircle, colorClass: "bg-red-100 text-red-600" },
    { title: "Sobra (Não registradas)", value: formatCurrency(data.kpis.globalSobrantesRs), subtitle: "Custo de sobra", icon: ArrowUpCircle, colorClass: "bg-orange-100 text-orange-600" },
    { title: "Acuracidade", value: `${data.kpis.acuracidadeGeral.toFixed(2)}%`, subtitle: "Índice de assertividade", icon: CheckCircle2, colorClass: data.kpis.acuracidadeGeral > 95 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600" },
  ] : []

  const columns = [
    { 
      key: "date", 
      header: "Data", 
      render: (r: any) => format(new Date(r.date), "dd/MM/yyyy HH:mm") 
    },
    { key: "name", header: "Nome da Contagem" },
    { 
      key: "status", 
      header: "Status",
      render: (r: any) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${r.status === 'APPLIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {r.status === 'APPLIED' ? 'Aplicado' : 'Em Andamento'}
        </span>
      )
    },
    { 
      key: "itemsCount", 
      header: "SKUs", 
      align: "center" as const
    },
    { 
      key: "divergences", 
      header: "Divergência (Falta / Sobra)", 
      align: "center" as const,
      render: (r: any) => (
        <div className="flex gap-2 justify-center font-semibold">
          <span className="text-red-500">-{r.pecasFaltantes}</span>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-500">+{r.pecasSobrantes}</span>
        </div>
      )
    },
    { 
      key: "valorFaltante", 
      header: "Impacto R$ (Perda)", 
      align: "right" as const,
      render: (r: any) => <span className="text-red-600 font-semibold">{formatCurrency(r.valorFaltante)}</span>
    },
    { 
      key: "acuracidade", 
      header: "Acuracidade", 
      align: "right" as const,
      render: (r: any) => <span className={`font-semibold ${r.acuracidade > 95 ? 'text-emerald-600' : 'text-amber-600'}`}>{r.acuracidade.toFixed(2)}%</span>
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Relatório de Inventário & Divergências" 
        icon={ClipboardList} 
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
        data={data?.sessions || []} 
        isLoading={isLoading} 
      />
    </div>
  )
}
