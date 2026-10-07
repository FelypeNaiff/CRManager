"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Gift, Printer, MessageCircle } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportTable } from "@/components/reports/report-table"
import { getBirthdaysAction } from "@/lib/crm/crm-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export default function AniversariantesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString())

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getBirthdaysAction(parseInt(month))
      if (result.success) {
        setData(result.data || [])
      } else {
        toast({ variant: "destructive", title: "Erro ao carregar", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro inesperado." })
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePrint = () => {
    window.print()
  }

  const columns = [
    { 
      key: "birthDate", 
      header: "Data (Dia)", 
      render: (r: any) => format(new Date(r.birthDate), "dd/MMM", { locale: ptBR }).toUpperCase() 
    },
    { key: "childName", header: "Criança" },
    { 
      key: "ageToComplete", 
      header: "Idade a Completar", 
      align: "center" as const,
      render: (r: any) => `${r.ageToComplete} anos`
    },
    { key: "clothingSize", header: "Roupa", align: "center" as const },
    { key: "shoeSize", header: "Calçado", align: "center" as const },
    { key: "parentName", header: "Responsável" },
    { 
      key: "whatsapp", 
      header: "WhatsApp",
      render: (r: any) => {
        if (!r.whatsapp) return <span className="text-slate-400">Sem número</span>
        const waLink = `https://wa.me/55${r.whatsapp.replace(/\D/g, '')}`
        return (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium">
            <MessageCircle className="h-4 w-4" />
            {r.whatsapp}
          </a>
        )
      }
    }
  ]

  const months = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
    { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" }
  ]

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      <div className="print:hidden">
        <ReportHeader 
          title="Aniversariantes (Crianças)" 
          icon={Gift} 
          onToggleFilters={() => {}}
          onExportCsv={() => {}}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Mês de Referência:</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handlePrint} className="bg-slate-900 text-white hover:bg-slate-800">
          <Printer className="h-4 w-4 mr-2" />
          Gerar PDF / Imprimir
        </Button>
      </div>

      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-2xl font-bold">Relatório de Aniversariantes - Mês {month}</h1>
        <p className="text-slate-500">Folha de contatos gerada pelo CRManager</p>
      </div>

      <ReportTable 
        columns={columns} 
        data={data} 
        isLoading={isLoading} 
      />
    </div>
  )
}
