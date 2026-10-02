import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"

export interface ReportAdvancedFiltersProps {
  isOpen: boolean
  onApply?: () => void
  onClear?: () => void
  children?: React.ReactNode // For passing custom specific inputs (like selects or dates)
}

export function ReportAdvancedFilters({ isOpen, onApply, onClear, children }: ReportAdvancedFiltersProps) {
  if (!isOpen) return null

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-500" />
        Filtros Avançados
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {children}
      </div>
      
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClear}>Limpar Filtros</Button>
        <Button onClick={onApply} className="bg-indigo-600 hover:bg-indigo-700">Aplicar Filtros</Button>
      </div>
    </div>
  )
}
