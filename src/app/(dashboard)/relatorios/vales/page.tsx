"use client"

import React, { useState, useEffect } from "react"
import { Users, Banknote, Calendar } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportKpiCards } from "@/components/reports/report-kpi-cards"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"

export default function ValesReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Mock data for Vales
  const kpis = [
    { title: "Total de Vales (Mês)", value: "R$ 4.500,00", subtitle: "22 vales emitidos", icon: Banknote, colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Colaboradores com Vale", value: "8", subtitle: "No período filtrado", icon: Users, colorClass: "bg-orange-100 text-orange-600" },
  ]

  const columns = [
    { key: "date", header: "Data" },
    { key: "employee", header: "Colaboradora" },
    { key: "description", header: "Descrição / Motivo" },
    { key: "amount", header: "Valor (R$)", align: "right" as const },
    { 
      key: "status", 
      header: "Status",
      render: (row: any) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row.status === 'Descontado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {row.status}
        </span>
      )
    }
  ]

  const mockData = [
    { date: "15/10/2026", employee: "Maria Silva", description: "Adiantamento Quinzenal", amount: "R$ 600,00", status: "Pendente" },
    { date: "10/10/2026", employee: "Ana Costa", description: "Vale Farmácia", amount: "R$ 150,00", status: "Descontado" },
  ]

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Relatório de Vales e Adiantamentos" 
        icon={Banknote} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={() => {}}
        onManageColumns={() => {}}
      />

      <ReportAdvancedFilters isOpen={showFilters} onClear={() => {}} onApply={() => {}}>
        <div className="space-y-2">
          <label className="text-sm font-medium">Data Inicial</label>
          <Input type="date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Data Final</label>
          <Input type="date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Colaboradora</label>
          <Input placeholder="Buscar por nome..." />
        </div>
      </ReportAdvancedFilters>

      <ReportKpiCards cards={kpis} />

      <ReportTable 
        columns={columns} 
        data={mockData} 
        isLoading={isLoading} 
      />
    </div>
  )
}
