const fs = require('fs');

const content = `"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { safeInteger, safeNumber } from "@/lib/utils/form-normalizer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Filter, 
  Download, 
  MessageSquare, 
  Users, 
  Baby, 
  Wallet, 
  Calendar, 
  DollarSign, 
  Tag, 
  UserCheck, 
  Clock, 
  Loader2,
  AlertCircle
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { getSegmentationData } from "@/lib/crm/actions"

const MESES = [
  { val: "1", label: "Janeiro" },
  { val: "2", label: "Fevereiro" },
  { val: "3", label: "Março" },
  { val: "4", label: "Abril" },
  { val: "5", label: "Maio" },
  { val: "6", label: "Junho" },
  { val: "7", label: "Julho" },
  { val: "8", label: "Agosto" },
  { val: "9", label: "Setembro" },
  { val: "10", label: "Outubro" },
  { val: "11", label: "Novembro" },
  { val: "12", label: "Dezembro" },
]

export default function SegmentacoesPage() {
  const router = useRouter()

  const [filterComSaldo, setFilterComSaldo] = useState(false)
  const [filterMesAniversario, setFilterMesAniversario] = useState("null")
  const [filterMesAniversarioFilho, setFilterMesAniversarioFilho] = useState("null")
  const [filterKidSexo, setFilterKidSexo] = useState("null")
  const [filterKidIdadeMin, setFilterKidIdadeMin] = useState("")
  const [filterKidIdadeMax, setFilterKidIdadeMax] = useState("")
  const [filterKidTamanhoRoupa, setFilterKidTamanhoRoupa] = useState("")
  const [filterKidTamanhoCalcado, setFilterKidTamanhoCalcado] = useState("")
  const [filterVip, setFilterVip] = useState("all")
  const [filterInatividade, setFilterInatividade] = useState("all")
  const [filterTicketMedioMin, setFilterTicketMedioMin] = useState("")
  const [filterTicketMedioMax, setFilterTicketMedioMax] = useState("")
  const [filterTotalCompradoMin, setFilterTotalCompradoMin] = useState("")
  const [selectedTagsFilter, setSelectedTagsFilter] = useState<string[]>([])

  const [clientes, setClientes] = useState<any[]>([])
  const [clientStats, setClientStats] = useState<Record<string, any>>({})
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const res = await getSegmentationData()
      if (res.success && res.data) {
        setClientes(res.data.clientes)
        setClientStats(res.data.stats)
        setTags(res.data.tags)
      } else {
        setError(res.error as string)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredClients = useMemo(() => {
    if (!clientes) return []

    return clientes.filter((c: any) => {
      const cleanWhats = (c.whatsapp_principal || c.whatsapp || "").replace(/\\D/g, "")
      if (cleanWhats.length < 10) return false
      
      if (c.aceita_marketing === false || c.aceita_marketing_whatsapp === false) return false

      const stat = clientStats[c.id]
      if (!stat) return false

      if (filterVip !== "all") {
        const isVip = !!c.vip
        if (filterVip === "yes" && !isVip) return false
        if (filterVip === "no" && isVip) return false
      }

      if (filterComSaldo && stat.saldoDisponivel <= 0) return false

      if (filterMesAniversario && filterMesAniversario !== "null") {
        const dateField = c.data_nascimento
        if (!dateField) return false
        const mes = new Date(dateField).getMonth() + 1
        if (mes !== safeInteger(filterMesAniversario)) return false
      }

      if (filterInatividade !== "all") {
        if (!stat.ultimaCompra) return false
        const daysSinceLastSale = Math.floor((Date.now() - new Date(stat.ultimaCompra).getTime()) / (1000 * 60 * 60 * 24))
        if (filterInatividade === "30" && daysSinceLastSale < 30) return false
        if (filterInatividade === "60" && daysSinceLastSale < 60) return false
        if (filterInatividade === "90" && daysSinceLastSale < 90) return false
      }

      const safeTicketMin = safeNumber(filterTicketMedioMin)
      if (safeTicketMin !== null && stat.ticketMedio < safeTicketMin) return false
      const safeTicketMax = safeNumber(filterTicketMedioMax)
      if (safeTicketMax !== null && stat.ticketMedio > safeTicketMax) return false

      const safeTotalMin = safeNumber(filterTotalCompradoMin)
      if (safeTotalMin !== null && stat.totalComprado < safeTotalMin) return false

      if (selectedTagsFilter.length > 0) {
        const matchesAll = selectedTagsFilter.every(t => stat.tags.includes(t))
        if (!matchesAll) return false
      }

      if (
        (filterKidSexo && filterKidSexo !== "null") || 
        filterKidIdadeMin || 
        filterKidIdadeMax || 
        filterKidTamanhoRoupa || 
        filterKidTamanhoCalcado || 
        (filterMesAniversarioFilho && filterMesAniversarioFilho !== "null")
      ) {
        if (stat.filhos.length === 0) return false

        const hasMatchingKid = stat.filhos.some((k: any) => {
          if (filterKidSexo && filterKidSexo !== "null" && k.sexo !== filterKidSexo) return false
          
          if (k.data_nascimento) {
            const kidAge = new Date().getFullYear() - new Date(k.data_nascimento).getFullYear()
            const sMin = safeNumber(filterKidIdadeMin)
            if (sMin !== null && kidAge < sMin) return false
            const sMax = safeNumber(filterKidIdadeMax)
            if (sMax !== null && kidAge > sMax) return false
          } else {
            if (filterKidIdadeMin || filterKidIdadeMax) return false
          }

          if (filterKidTamanhoRoupa && k.tamanho_roupa !== filterKidTamanhoRoupa) return false
          if (filterKidTamanhoCalcado && k.tamanho_calcado !== filterKidTamanhoCalcado) return false

          if (filterMesAniversarioFilho && filterMesAniversarioFilho !== "null") {
            if (!k.data_nascimento) return false
            const mes = new Date(k.data_nascimento).getMonth() + 1
            if (mes !== safeInteger(filterMesAniversarioFilho)) return false
          }

          return true
        })

        if (!hasMatchingKid) return false
      }

      return true
    })
  }, [clientes, clientStats, filterComSaldo, filterMesAniversario, filterMesAniversarioFilho, filterKidSexo, filterKidIdadeMin, filterKidIdadeMax, filterKidTamanhoRoupa, filterKidTamanhoCalcado, filterVip, filterInatividade, filterTicketMedioMin, filterTicketMedioMax, filterTotalCompradoMin, selectedTagsFilter])

  const handleClearFilters = () => {
    setFilterComSaldo(false)
    setFilterMesAniversario("null")
    setFilterMesAniversarioFilho("null")
    setFilterKidSexo("null")
    setFilterKidIdadeMin("")
    setFilterKidIdadeMax("")
    setFilterKidTamanhoRoupa("")
    setFilterKidTamanhoCalcado("")
    setFilterVip("all")
    setFilterInatividade("all")
    setFilterTicketMedioMin("")
    setFilterTicketMedioMax("")
    setFilterTotalCompradoMin("")
    setSelectedTagsFilter([])
  }

  const handleToggleTagFilter = (tagNome: string) => {
    if (selectedTagsFilter.includes(tagNome)) {
      setSelectedTagsFilter(selectedTagsFilter.filter(t => t !== tagNome))
    } else {
      setSelectedTagsFilter([...selectedTagsFilter, tagNome])
    }
  }

  const handleExportCsv = () => {
    if (filteredClients.length === 0) {
      toast({ variant: "destructive", title: "Nenhum cliente elegível", description: "Não há contatos para exportar." })
      return
    }

    const headers = ["Nome", "WhatsApp", "VIP", "Saldo Carteira", "Filhos", "Ticket Médio"]
    const rows = filteredClients.map((c: any) => {
      const statsObj = clientStats[c.id]
      const kidsList = statsObj?.filhos.map((k: any) => \`\${k.nome} (\${k.tamanho_roupa || 'N/A'})\`).join(" | ") || ""
      return [
        c.nome,
        c.whatsapp_principal || c.whatsapp,
        c.vip ? "SIM" : "NAO",
        \`R$ \${(statsObj?.saldoDisponivel || 0).toFixed(2)}\`,
        kidsList,
        \`R$ \${(statsObj?.ticketMedio || 0).toFixed(2)}\`
      ]
    })

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map((e: any) => e.map((val: any) => \`"\${String(val).replace(/"/g, '""')}"\`).join(","))].join("\\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", \`segmentacao_whatsapp_\${format(new Date(), "yyyy-MM-dd")}.csv\`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Contatos exportados!", description: "Arquivo CSV de marketing gerado." })
  }

  const handleCreateCampaign = () => {
    if (filteredClients.length === 0) {
      toast({ variant: "destructive", title: "Erro", description: "Não é possível criar uma campanha com público vazio." })
      return
    }

    localStorage.setItem("crm_active_segment", JSON.stringify({
      filtros: {
        filterComSaldo,
        filterMesAniversario,
        filterMesAniversarioFilho,
        filterKidSexo,
        filterKidIdadeMin,
        filterKidIdadeMax,
        filterKidTamanhoRoupa,
        filterKidTamanhoCalcado,
        filterVip,
        filterInatividade,
        selectedTagsFilter
      },
      clientesIds: filteredClients.map((c: any) => c.id)
    }))

    router.push("/crm/campanhas?source=segmentation")
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <Filter className="h-6 w-6 text-indigo-600 animate-pulse" /> Motor de Segmentações & Filtros
          </h1>
          <p className="text-muted-foreground text-xs">Cruze dados de compras, filhos, medidas e saldos para disparar campanhas WhatsApp segmentadas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClearFilters} className="text-xs h-9">
            Limpar Filtros
          </Button>
          <Button onClick={handleExportCsv} className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5 text-xs h-9">
            <Download className="h-4 w-4" /> Exportar Contatos (CSV)
          </Button>
          <Button onClick={handleCreateCampaign} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 text-xs h-9">
            <MessageSquare className="h-4 w-4" /> Criar Campanha WhatsApp
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-slate-600">
                <Filter className="h-4 w-4 text-indigo-500" /> Console de Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-indigo-500" />
                  <span className="font-semibold text-slate-700">Com Crédito/Saldo</span>
                </div>
                <Switch checked={filterComSaldo} onCheckedChange={setFilterComSaldo} />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-500 uppercase text-[10px] flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /> Cliente VIP?</Label>
                <Select value={filterVip} onValueChange={setFilterVip}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    <SelectItem value="yes">Apenas VIPs</SelectItem>
                    <SelectItem value="no">Apenas Não VIPs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-500 uppercase text-[10px] flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Clientes Inativos</Label>
                <Select value={filterInatividade} onValueChange={setFilterInatividade}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer período de compra</SelectItem>
                    <SelectItem value="30">Sem comprar há +30 dias</SelectItem>
                    <SelectItem value="60">Sem comprar há +60 dias</SelectItem>
                    <SelectItem value="90">Sem comprar há +90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-500 uppercase text-[10px] flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Aniversário Cliente (Mês)</Label>
                <Select value={filterMesAniversario} onValueChange={setFilterMesAniversario}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione o mês..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Qualquer mês</SelectItem>
                    {MESES.map(m => (
                      <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-500 uppercase text-[10px] flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Ticket Médio Mínimo</Label>
                <Input 
                  type="number" 
                  value={filterTicketMedioMin}
                  onChange={e => setFilterTicketMedioMin(e.target.value)}
                  placeholder="R$ 100" 
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-500 uppercase text-[10px] flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Total Comprado Mínimo</Label>
                <Input 
                  type="number" 
                  value={filterTotalCompradoMin}
                  onChange={e => setFilterTotalCompradoMin(e.target.value)}
                  placeholder="R$ 500" 
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1"><Baby className="h-3.5 w-3.5 text-pink-500" /> Filtros do Filho</span>

                <div className="space-y-1">
                  <Label className="font-semibold text-slate-500 uppercase text-[10px]">Gênero</Label>
                  <Select value={filterKidSexo} onValueChange={setFilterKidSexo}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Gênero do filho..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Qualquer um</SelectItem>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="font-semibold text-slate-500 uppercase text-[10px]">Idade Mín</Label>
                    <Input 
                      type="number" 
                      value={filterKidIdadeMin} 
                      onChange={e => setFilterKidIdadeMin(e.target.value)} 
                      placeholder="0" 
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-slate-500 uppercase text-[10px]">Idade Máx</Label>
                    <Input 
                      type="number" 
                      value={filterKidIdadeMax} 
                      onChange={e => setFilterKidIdadeMax(e.target.value)} 
                      placeholder="16" 
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="font-semibold text-slate-500 uppercase text-[10px]">Tam. Roupa</Label>
                    <Input 
                      value={filterKidTamanhoRoupa} 
                      onChange={e => setFilterKidTamanhoRoupa(e.target.value.toUpperCase())} 
                      placeholder="Ex: 4" 
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-slate-500 uppercase text-[10px]">Tam. Calçado</Label>
                    <Input 
                      value={filterKidTamanhoCalcado} 
                      onChange={e => setFilterKidTamanhoCalcado(e.target.value)} 
                      placeholder="Ex: 24" 
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-slate-500 uppercase text-[10px]">Aniversário Filho (Mês)</Label>
                  <Select value={filterMesAniversarioFilho} onValueChange={setFilterMesAniversarioFilho}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Selecione o mês..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Qualquer mês</SelectItem>
                      {MESES.map(m => (
                        <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1"><Tag className="h-3.5 w-3.5 text-indigo-500" /> Filtrar por Tags</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags?.map((t: any) => {
                    const isSelected = selectedTagsFilter.includes(t.nome)
                    return (
                      <Badge 
                        key={t.id}
                        onClick={() => handleToggleTagFilter(t.nome)}
                        style={{ backgroundColor: isSelected ? t.color || "#4f46e5" : "#e2e8f0", color: isSelected ? "white" : "#475569" }}
                        className="text-[10px] cursor-pointer border-0 py-0.5 px-2 font-medium"
                      >
                        {t.name} {isSelected && "✓"}
                      </Badge>
                    )
                  })}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border bg-gradient-to-br from-indigo-900 to-indigo-950 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-2 right-2 text-indigo-500 opacity-20"><Users className="h-28 w-28" /></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">Clientes Elegíveis</CardDescription>
                <h2 className="text-4xl font-headline font-bold tracking-tight mt-1">{filteredClients.length}</h2>
              </CardHeader>
              <CardContent className="pb-4 text-[10px] text-indigo-200 font-medium">
                Contatos com WhatsApp válido e aceite de marketing.
              </CardContent>
            </Card>

            <Card className="border bg-white shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Volume de Saldos Elegíveis</CardDescription>
                <h2 className="text-2xl font-bold tracking-tight text-emerald-600 mt-1">
                  R$ {filteredClients.reduce((acc: number, c: any) => acc + (clientStats[c.id]?.saldoDisponivel || 0), 0).toFixed(2)}
                </h2>
              </CardHeader>
              <CardContent className="pb-4 text-[10px] text-slate-400">
                Saldos totais acumulados dos contatos filtrados.
              </CardContent>
            </Card>

            <Card className="border bg-white shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Ticket Médio Consolidado</CardDescription>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-600 mt-1">
                  R$ {(() => {
                    if (filteredClients.length === 0) return "0.00"
                    const sum = filteredClients.reduce((acc: number, c: any) => acc + (clientStats[c.id]?.ticketMedio || 0), 0)
                    return (sum / filteredClients.length).toFixed(2)
                  })()}
                </h2>
              </CardHeader>
              <CardContent className="pb-4 text-[10px] text-slate-400">
                Média aritmética de compras do público segmentado.
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Filtro de Contatos Ativos ({filteredClients.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center p-20 text-muted-foreground text-xs">
                  Nenhum cliente elegível atende aos filtros configurados.
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-600">Cliente / Resp</TableHead>
                      <TableHead className="font-semibold text-slate-600">WhatsApp</TableHead>
                      <TableHead className="font-semibold text-slate-600">Filhos</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">Saldo Carteira</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">Ticket Médio</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">Última Compra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((c: any) => {
                      const statsObj = clientStats[c.id]
                      return (
                        <TableRow key={c.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-bold text-slate-700">
                            {c.nome}
                            {c.vip && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-bold ml-1.5">VIP ★</Badge>}
                          </TableCell>
                          <TableCell className="text-slate-500 font-mono">
                            {c.whatsapp_principal || c.whatsapp}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {statsObj?.filhos.map((f: any) => (
                              <Badge key={f.id} variant="outline" className="text-[9px] mr-1 bg-slate-50 border-slate-200">
                                {f.nome} ({f.tamanho_roupa || 'N/A'})
                              </Badge>
                            ))}
                          </TableCell>
                          <TableCell className={\`text-right font-bold \${statsObj?.saldoDisponivel > 0 ? 'text-indigo-600' : 'text-slate-400'}\`}>
                            R$ {(statsObj?.saldoDisponivel || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            R$ {(statsObj?.ticketMedio || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-slate-400 whitespace-nowrap">
                            {statsObj?.ultimaCompra ? format(new Date(statsObj.ultimaCompra), "dd/MM/yyyy") : "-"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
`;

fs.writeFileSync('src/app/(dashboard)/crm/segmentacoes/page.tsx', content, 'utf8');
