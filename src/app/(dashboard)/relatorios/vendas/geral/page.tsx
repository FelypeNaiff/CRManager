"use client"

import React, { useState, useEffect, useCallback } from "react"
import { ShoppingCart, TrendingUp, DollarSign, Percent, Award } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { ReportPaymentMethodsBar } from "@/components/reports/report-payment-methods-bar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSalesReportAction, SalesReportFilters } from "@/lib/reports/reports-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function VendasGeralReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  // Filters state
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: SalesReportFilters = {
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
        status: status && status !== "ALL" ? status : undefined
      }

      const result = await getSalesReportAction(filters)
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
  }, [startDate, endDate, status])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportCsv = () => {
    if (!data || !data.sales) return
    const headers = ["Data", "Cliente", "Vendedor", "Status", "Formas de Pagamento", "Valor Líquido"]
    const rows = data.sales.map((s: any) => [
      format(new Date(s.date), "dd/MM/yyyy HH:mm"),
      s.customerName,
      s.sellerName,
      s.status,
      s.paymentMethods,
      s.totalAmount.toString()
    ])
    
    const csvContent = [
      headers.join(";"),
      ...rows.map((r: any) => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `relatorio_vendas_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const kpis = data?.kpis ? [
    { title: "Faturamento Bruto", value: formatCurrency(data.kpis.faturamentoBruto), subtitle: "Soma das vendas válidas", icon: DollarSign, colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Custos Totais", value: formatCurrency(data.kpis.custosTotais), subtitle: "Custo de produto + Frete", icon: ShoppingCart, colorClass: "bg-rose-100 text-rose-600" },
    { title: "Lucro Líquido", value: formatCurrency(data.kpis.lucroLiquido), subtitle: `Margem: ${data.kpis.margem.toFixed(2)}%`, icon: TrendingUp, colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Ticket Médio", value: formatCurrency(data.kpis.ticketMedio), subtitle: "Por venda concretizada", icon: Award, colorClass: "bg-amber-100 text-amber-600" },
  ] : []

  const paymentTotals = data?.paymentDistribution ? [
    { method: "PIX", label: "Pix", amount: data.paymentDistribution.PIX, colorClass: "text-emerald-500" },
    { method: "CREDITO", label: "Cartão de Crédito", amount: data.paymentDistribution.CREDITO, colorClass: "text-blue-500" },
    { method: "DEBITO", label: "Cartão de Débito", amount: data.paymentDistribution.DEBITO, colorClass: "text-indigo-500" },
    { method: "DINHEIRO", label: "Dinheiro", amount: data.paymentDistribution.DINHEIRO, colorClass: "text-emerald-700" },
    { method: "CARTEIRA", label: "Saldo Carteira", amount: data.paymentDistribution.CARTEIRA, colorClass: "text-amber-500" },
    { method: "OUTROS", label: "Outros", amount: data.paymentDistribution.OUTROS, colorClass: "text-slate-500" }
  ].filter(p => p.amount > 0) as any[] : []

  const columns = [
    { 
      key: "date", 
      header: "Data / Horário", 
      render: (r: any) => format(new Date(r.date), "dd/MM/yyyy 'às' HH:mm") 
    },
    { key: "customerName", header: "Cliente" },
    { key: "sellerName", header: "Vendedor" },
    { 
      key: "status", 
      header: "Situação",
      render: (r: any) => {
        if (r.status === "COMPLETED" || r.status === "DELIVERED") {
          return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 flex items-center w-fit gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Concretizada</span>
        }
        if (r.status === "CANCELLED") {
          return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-700 flex items-center w-fit gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Cancelada</span>
        }
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">{r.status}</span>
      }
    },
    { key: "paymentMethods", header: "Pagamento" },
    { 
      key: "totalAmount", 
      header: "Valor Líquido", 
      align: "right" as const,
      render: (r: any) => <span className="font-semibold">{formatCurrency(r.totalAmount)}</span>
    }
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Relatório Geral de Vendas" 
        icon={ShoppingCart} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={handleExportCsv}
      />

      <ReportAdvancedFilters 
        isOpen={showFilters} 
        onClear={() => { setStartDate(""); setEndDate(""); setStatus(""); }} 
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
          <label className="text-sm font-medium">Situação</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as situações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as situações</SelectItem>
              <SelectItem value="COMPLETED">Concretizada</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="CANCELLED">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ReportAdvancedFilters>

      {kpis.length > 0 && <ReportKpiCards cards={kpis} />}

      {paymentTotals.length > 0 && <ReportPaymentMethodsBar totals={paymentTotals} />}

      <ReportTable 
        columns={columns} 
        data={data?.sales || []} 
        isLoading={isLoading} 
      />
    </div>
  )
}
