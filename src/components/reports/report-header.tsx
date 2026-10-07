"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { LucideIcon, Filter, Printer, Download, Columns } from "lucide-react"

export interface ReportHeaderProps {
  title: string
  icon: LucideIcon
  onToggleFilters?: () => void
  onExportCsv?: () => void
  onManageColumns?: () => void
  showFiltersToggle?: boolean
}

export function ReportHeader({
  title,
  icon: Icon,
  onToggleFilters,
  onExportCsv,
  onManageColumns,
  showFiltersToggle = true
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-headline text-slate-800">{title}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onManageColumns && (
          <Button variant="outline" size="sm" onClick={onManageColumns} className="gap-2 text-slate-600">
            <Columns className="h-4 w-4" /> Colunas
          </Button>
        )}
        {onExportCsv && (
          <Button variant="outline" size="sm" onClick={onExportCsv} className="gap-2 text-slate-600">
            <Download className="h-4 w-4" /> CSV
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 text-slate-600 hidden sm:flex">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
        {showFiltersToggle && onToggleFilters && (
          <Button onClick={onToggleFilters} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            <Filter className="h-4 w-4" /> Filtros
          </Button>
        )}
      </div>
    </div>
  )
}
