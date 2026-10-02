"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, UserPlus, PlusCircle } from "lucide-react"

interface CustomerFiltersProps {
  isBirthdayView: boolean
  birthdayMonth: number
  setBirthdayMonth: (m: number) => void
  birthdayDay: string
  setBirthdayDay: (d: string) => void
  searchTerm: string
  setSearchTerm: (t: string) => void
  statusFilter: string
  setStatusFilter: (s: string) => void
  canCreate: boolean
  onOpenCreate: (rapido: boolean) => void
}

export function CustomerFilters({
  isBirthdayView,
  birthdayMonth,
  setBirthdayMonth,
  birthdayDay,
  setBirthdayDay,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  canCreate,
  onOpenCreate
}: CustomerFiltersProps) {
  if (isBirthdayView) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-end">
        <label className="w-full space-y-1 md:w-64">
          <span className="text-sm font-medium">Mês</span>
          <select 
            className="h-10 w-full rounded-md border bg-background px-3" 
            value={birthdayMonth} 
            onChange={e => setBirthdayMonth(Number(e.target.value))}
          >
            {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((month,index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </label>
        <label className="w-full space-y-1 md:w-40">
          <span className="text-sm font-medium">Dia</span>
          <select 
            className="h-10 w-full rounded-md border bg-background px-3" 
            value={birthdayDay} 
            onChange={e => setBirthdayDay(e.target.value)}
          >
            <option value="">Todos os dias</option>
            {Array.from({length:31},(_,index) => index + 1).map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
      <div className="relative flex-1 w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, WhatsApp ou CPF..."
          className="pl-10 h-10 bg-slate-50/50"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="ativo">Somente Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="arquivado">Arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
