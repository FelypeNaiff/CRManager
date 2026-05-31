"use client"

import { useState, useMemo } from "react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore, useCollection, useMemoFirebase } from "@/supabase-mocks"
import { collection, query, where, orderBy, limit } from "@/supabase-mocks/firestore"
import { Search, Filter, History, Calendar, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigDataTable,
  ConfigDataTableHeader,
  ConfigDataTableRow,
  ConfigDataTableHead,
  ConfigDataTableBody,
  ConfigDataTableCell,
  ConfigStatusBadge
} from "@/components/configuracoes/config-ui"

export default function LogsAtividadesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [moduloFiltro, setModuloFiltro] = useState("TODOS")
  const [acaoFiltro, setAcaoFiltro] = useState("TODOS")

  const db = useFirestore()
  const { activeProfile } = useProfile()
  
  // Queries
  const logsQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.empresaId) return null
    // Em produção, seria ideal limitar ou fazer paginação real com startAfter
    return query(
      collection(db, "logs_atividades"), 
      where("empresa_id", "==", activeProfile.empresaId),
      // orderBy("data_hora", "desc"), // Requer índice composto no Firestore para orderBy junto com where
      limit(200)
    )
  }, [db, activeProfile?.empresaId])

  const { data: rawLogs, isLoading } = useCollection(logsQuery)
  const logs = rawLogs ?? []

  // Módulos únicos para o filtro
  const modulosUnicos = useMemo(() => {
    const mods = new Set<string>()
    logs.forEach((log: any) => {
      const modulo = String(log.modulo || "").trim()
      if (modulo) mods.add(modulo)
    })
    return Array.from(mods).sort()
  }, [logs])

  // Filtragem local
  const filteredLogs = useMemo(() => {
    let result = [...logs]

    // Sort manual caso o orderBy falhe por falta de índice
    result.sort((a, b) => {
      const timeA = a.data_hora?.toMillis?.() || 0
      const timeB = b.data_hora?.toMillis?.() || 0
      return timeB - timeA
    })

    if (moduloFiltro !== "TODOS") {
      result = result.filter(log => log.modulo === moduloFiltro)
    }

    if (acaoFiltro !== "TODOS") {
      result = result.filter(log => log.acao === acaoFiltro)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(log => 
        log.usuario_nome?.toLowerCase().includes(term) ||
        log.registro_id?.toLowerCase().includes(term) ||
        log.detalhes?.toLowerCase().includes(term)
      )
    }

    return result
  }, [logs, moduloFiltro, acaoFiltro, searchTerm])

  const formatDateTime = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return "-"
    const date = timestamp.toDate()
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date)
  }

  const formatAcaoBadge = (acao: string) => {
    switch (acao) {
      case "CREATE": return <ConfigStatusBadge status="CRIAR" />
      case "UPDATE": return <ConfigStatusBadge status="EDITAR" />
      case "DELETE": return <ConfigStatusBadge status="EXCLUIR" />
      case "LOGIN": return <ConfigStatusBadge status="LOGIN" />
      case "LOGOUT": return <ConfigStatusBadge status="LOGOUT" />
      default: return <ConfigStatusBadge status={acao || "AÇÃO"} />
    }
  }

  return (
    <div className="max-w-[1400px] space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader 
          title="Logs de Atividades" 
          description="Rastreie todas as ações importantes realizadas no sistema para auditoria e segurança."
          breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Logs" }]}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 text-slate-600">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <ConfigCardSection title="Filtro de logs">
        {/* BARRA DE BUSCA E FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar usuário ou registro..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={moduloFiltro} onValueChange={setModuloFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os Módulos</SelectItem>
              {modulosUnicos.map(mod => (
                <SelectItem key={mod} value={mod}>{mod}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={acaoFiltro} onValueChange={setAcaoFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todas as Ações</SelectItem>
              <SelectItem value="CREATE">Criações (CREATE)</SelectItem>
              <SelectItem value="UPDATE">Edições (UPDATE)</SelectItem>
              <SelectItem value="DELETE">Exclusões (DELETE)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
            <Calendar className="mr-2 h-4 w-4" />
            Período: Últimos 30 dias
          </Button>
        </div>

        {/* TABELA DE LOGS */}
        <div className="border rounded-lg overflow-x-auto">
          <ConfigDataTable className="min-w-[1000px]">
            <ConfigDataTableHeader>
              <ConfigDataTableRow>
                <ConfigDataTableHead className="w-[180px]">Data / Hora</ConfigDataTableHead>
                <ConfigDataTableHead className="w-[180px]">Usuário</ConfigDataTableHead>
                <ConfigDataTableHead className="w-[150px]">Módulo</ConfigDataTableHead>
                <ConfigDataTableHead className="w-[100px]">Ação</ConfigDataTableHead>
                <ConfigDataTableHead>Detalhes / Registro</ConfigDataTableHead>
                <ConfigDataTableHead className="w-[120px]">IP</ConfigDataTableHead>
                <ConfigDataTableHead className="w-[120px]">Dispositivo</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {isLoading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Carregando trilha de auditoria...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredLogs.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-12 text-muted-foreground flex flex-col items-center">
                    <History className="h-8 w-8 text-slate-300 mb-2" />
                    Nenhum registro encontrado para os filtros atuais.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredLogs.map((log: any) => (
                  <ConfigDataTableRow key={log.id} className="hover:bg-slate-50/50 text-sm">
                    <ConfigDataTableCell className="text-slate-500 font-mono text-xs">
                      {formatDateTime(log.data_hora)}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="font-medium text-slate-800">
                      {log.usuario_nome || log.usuario_id || "Sistema"}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-slate-600">
                      {log.modulo}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      {formatAcaoBadge(log.acao)}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-slate-500 mb-1">ID: {log.registro_id || "-"}</span>
                        {log.detalhes && (
                          <span className="text-slate-700 truncate max-w-sm" title={log.detalhes}>
                            {log.detalhes}
                          </span>
                        )}
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-slate-400 font-mono text-xs">
                      {log.ip || "127.0.0.1"}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-slate-400 text-xs">
                      {log.dispositivo || "Web Browser"}
                    </ConfigDataTableCell>
                  </ConfigDataTableRow>
                ))
              )}
            </ConfigDataTableBody>
          </ConfigDataTable>
        </div>
      </ConfigCardSection>
    </div>
  )
}
