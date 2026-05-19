"use client"

import React, { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { History, Search, Loader2, Calendar, User, Eye, AlertCircle, RefreshCw } from "lucide-react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { useProfile } from "@/lib/contexts/profile-context"

export default function HistoricoCrmPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"

  const [searchTerm, setSearchTerm] = useState("")
  const [moduleFilter, setModuleFilter] = useState("todos")

  // Query global activity logs
  const logsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "logs_atividades"),
      where("empresa_id", "==", tenantId)
    )
  }, [db, tenantId])

  const { data: logsData, isLoading, error } = useCollection(logsQuery)

  // Sort logs by timestamp (newest first)
  const sortedLogs = useMemo(() => {
    if (!logsData) return []
    return [...logsData]
      .sort((a, b) => {
        const timeA = a.data_hora?.seconds || new Date(a.data_hora).getTime() / 1000 || 0
        const timeB = b.data_hora?.seconds || new Date(b.data_hora).getTime() / 1000 || 0
        return timeB - timeA
      })
      .filter(log => {
        // Match Search
        const matchSearch = 
          log.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.detalhes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.acao?.toLowerCase().includes(searchTerm.toLowerCase())
        
        // Match Module
        const matchModule = moduleFilter === "todos" || log.modulo === moduleFilter
        
        return matchSearch && matchModule
      })
  }, [logsData, searchTerm, moduleFilter])

  // Extract unique module names for filters
  const modules = useMemo(() => {
    if (!logsData) return []
    const unique = new Set<string>()
    logsData.forEach(l => {
      if (l.modulo) unique.add(l.modulo)
    })
    return Array.from(unique)
  }, [logsData])

  const getAcaoColor = (acao: string) => {
    switch (acao) {
      case "CREATE": return "bg-emerald-100 text-emerald-700 border-emerald-200"
      case "UPDATE": return "bg-blue-100 text-blue-700 border-blue-200"
      case "SOFT_DELETE": 
      case "DELETE": return "bg-rose-100 text-rose-700 border-rose-200"
      default: return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <History className="h-8 w-8 text-indigo-600" /> Auditoria & Histórico CRM
        </h1>
        <p className="text-muted-foreground text-sm">Visualização consolidada de auditoria de alterações, logs de acessos, e modificações na carteira de clientes.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por colaborador, ação ou detalhes..."
            className="pl-10 h-10 bg-slate-50/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <SelectFilter value={moduleFilter} onChange={setModuleFilter} options={modules} />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
          <p className="text-sm">{(error as any).message || "Erro ao listar logs."}</p>
        </div>
      )}

      {/* Timeline list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-muted-foreground text-xs">Carregando trilha de auditoria...</p>
        </div>
      ) : sortedLogs.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-slate-50/40 text-muted-foreground text-xs">
          Nenhum log de auditoria registrado na base ainda.
        </div>
      ) : (
        <Card className="border shadow-sm rounded-xl bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y text-xs">
              {sortedLogs.slice(0, 100).map((log, idx) => {
                const logDate = log.data_hora?.seconds 
                  ? new Date(log.data_hora.seconds * 1000) 
                  : new Date(log.data_hora)

                return (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-700 text-sm">{log.usuario_nome || "Sistema"}</span>
                          <Badge variant="outline" className={`text-[9px] font-semibold h-4 ${getAcaoColor(log.acao)}`}>
                            {log.acao}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] h-4 bg-slate-50 text-slate-500 font-normal">
                            {log.modulo || "Geral"}
                          </Badge>
                        </div>
                        <p className="text-slate-600 leading-relaxed max-w-2xl">{log.detalhes}</p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 flex items-center sm:flex-col gap-2 sm:gap-0.5 text-slate-400 text-[10px]">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3 w-3" />
                        {logDate.toLocaleString("pt-BR")}
                      </span>
                      {log.registro_id && (
                        <span className="font-mono text-slate-300">ID: {log.registro_id.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SelectFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="h-10 px-3 border rounded-lg bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full md:w-[200px]"
    >
      <option value="todos">Todos os Módulos</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
