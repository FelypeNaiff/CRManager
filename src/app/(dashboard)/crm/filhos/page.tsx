"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Baby, MessageCircle } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { ReportTable } from "@/components/reports/report-table"
import { ReportAdvancedFilters } from "@/components/reports/report-advanced-filters"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getChildrenAction, ChildrenFilters } from "@/lib/crm/crm-actions"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function FilhosReportPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  const [minAge, setMinAge] = useState("")
  const [maxAge, setMaxAge] = useState("")
  const [gender, setGender] = useState("TODOS")
  const [clothingSize, setClothingSize] = useState("")
  const [shoeSize, setShoeSize] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: ChildrenFilters = {
        minAge: minAge ? parseInt(minAge) : undefined,
        maxAge: maxAge ? parseInt(maxAge) : undefined,
        gender: gender !== "TODOS" ? gender : undefined,
        clothingSize: clothingSize || undefined,
        shoeSize: shoeSize || undefined
      }

      const result = await getChildrenAction(filters)
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
  }, [minAge, maxAge, gender, clothingSize, shoeSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const columns = [
    { key: "name", header: "Nome da Criança" },
    { key: "gender", header: "Sexo", align: "center" as const },
    { 
      key: "age", 
      header: "Idade", 
      align: "center" as const,
      render: (r: any) => `${r.age} anos`
    },
    { 
      key: "birthDate", 
      header: "Nascimento", 
      align: "center" as const,
      render: (r: any) => r.birthDate ? format(new Date(r.birthDate), "dd/MM/yyyy") : "-" 
    },
    { key: "clothingSize", header: "Roupa", align: "center" as const },
    { key: "shoeSize", header: "Calçado", align: "center" as const },
    { key: "parentName", header: "Responsável" },
    { 
      key: "whatsapp", 
      header: "WhatsApp (Responsável)",
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

  return (
    <div className="space-y-6">
      <ReportHeader 
        title="Dependentes e Filhos" 
        icon={Baby} 
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCsv={() => {}}
      />

      <ReportAdvancedFilters 
        isOpen={showFilters} 
        onClear={() => { setMinAge(""); setMaxAge(""); setGender("TODOS"); setClothingSize(""); setShoeSize(""); }} 
        onApply={loadData}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Idade Mínima</label>
          <Input type="number" placeholder="Ex: 2" value={minAge} onChange={e => setMinAge(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Idade Máxima</label>
          <Input type="number" placeholder="Ex: 8" value={maxAge} onChange={e => setMaxAge(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Sexo</label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="M">Menino</SelectItem>
              <SelectItem value="F">Menina</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tam. Roupa</label>
          <Input placeholder="Ex: 4, 6, P..." value={clothingSize} onChange={e => setClothingSize(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tam. Calçado</label>
          <Input placeholder="Ex: 24, 26..." value={shoeSize} onChange={e => setShoeSize(e.target.value)} />
        </div>
      </ReportAdvancedFilters>

      <ReportTable 
        columns={columns} 
        data={data} 
        isLoading={isLoading} 
      />
    </div>
  )
}
