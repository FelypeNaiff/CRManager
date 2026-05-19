"use client"

import React, { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { 
  Users, 
  Baby, 
  Wallet, 
  Repeat, 
  ShoppingCart, 
  MessageSquare, 
  TrendingUp, 
  Sparkles, 
  Calendar, 
  UserCheck, 
  Filter, 
  Search, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Tags,
  AlertTriangle,
  Gift,
  HelpCircle
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { useProfile } from "@/lib/contexts/profile-context"
import { format } from "date-fns"

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

// Helper to parse dates from various formats (Timestamp, String, Date object)
function parseDate(d: any): Date | null {
  if (!d) return null
  if (d.seconds) return new Date(d.seconds * 1000)
  if (d.toDate && typeof d.toDate === "function") return d.toDate()
  const date = new Date(d)
  return isNaN(date.getTime()) ? null : date
}

function getAgeInYears(birthdate: string): number | null {
  if (!birthdate) return null
  const birth = new Date(birthdate)
  if (isNaN(birth.getTime())) return null
  const diffMs = Date.now() - birth.getTime()
  const ageDate = new Date(diffMs)
  return Math.abs(ageDate.getUTCFullYear() - 1970)
}

export default function CrmDashboardPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"

  // Active sub-section tab
  const [activeTab, setActiveTab] = useState("overview") // overview, crm, filhos, carteiras, trocas, vendas, whatsapp

  // Advanced Filters State
  const [filtroPeriodo, setFiltroPeriodo] = useState("tudo") // tudo, 7d, 30d, mes, ano
  const [filtroStatusCliente, setFiltroStatusCliente] = useState("todos") // todos, ativo, inativo
  const [filtroVendedora, setFiltroVendedora] = useState("todos")
  const [filtroCanal, setFiltroCanal] = useState("todos")
  const [filtroVip, setFiltroVip] = useState("todos") // todos, sim, nao
  const [filtroSaldo, setFiltroSaldo] = useState("todos") // todos, com-saldo, sem-saldo
  const [filtroTamanhoFilho, setFiltroTamanhoFilho] = useState("todos")
  const [filtroIdadeFilho, setFiltroIdadeFilho] = useState("todos") // todos, 0-2, 3-5, 6-8, 9-12

  // 1. Fetch collections from Firestore
  const clientesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "clientes"), where("tenant_id", "==", tenantId), where("deleted_at", "==", null))
  }, [db, tenantId])
  const { data: clientes, isLoading: loadingClientes } = useCollection(clientesQuery)

  const filhosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "filhos"), where("tenant_id", "==", tenantId), where("status", "==", "ativo"))
  }, [db, tenantId])
  const { data: filhos } = useCollection(filhosQuery)

  const carteirasQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "carteiras_clientes"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])
  const { data: carteiras } = useCollection(carteirasQuery)

  const movimentacoesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "movimentacoes_saldo"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])
  const { data: movimentacoes } = useCollection(movimentacoesQuery)

  const trocasQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "trocas_devolucoes"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])
  const { data: trocas } = useCollection(trocasQuery)

  const vendasQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "vendas"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])
  const { data: vendas } = useCollection(vendasQuery)

  const campanhasQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "campanhas_whatsapp"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])
  const { data: campanhas } = useCollection(campanhasQuery)

  const produtosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "produtos")) // to map names
  }, [db])
  const { data: produtos } = useCollection(produtosQuery)

  // 2. Maps for quick O(1) correlation lookups
  const clientsMap = useMemo(() => {
    if (!clientes) return {}
    return clientes.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as any)
  }, [clientes])

  const productsMap = useMemo(() => {
    if (!produtos) return {}
    return produtos.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as any)
  }, [produtos])

  const walletsMap = useMemo(() => {
    if (!carteiras) return {}
    return carteiras.reduce((acc, w) => ({ ...acc, [w.cliente_id]: w.saldo_atual || 0 }), {} as any)
  }, [carteiras])

  const clientKidsMap = useMemo(() => {
    if (!filhos) return {}
    const map: Record<string, any[]> = {}
    filhos.forEach(k => {
      if (!map[k.cliente_id]) map[k.cliente_id] = []
      map[k.cliente_id].push(k)
    })
    return map
  }, [filhos])

  // Unique list of salespersons and payment forms for filters dropdowns
  const uniqueSalespersons = useMemo(() => {
    if (!vendas) return []
    const set = new Set<string>()
    vendas.forEach(v => { if (v.vendedorId) set.add(v.vendedorId) })
    return Array.from(set)
  }, [vendas])

  const uniquePaymentMethods = useMemo(() => {
    if (!vendas) return []
    const set = new Set<string>()
    vendas.forEach(v => { if (v.formaPagamento) set.add(v.formaPagamento) })
    return Array.from(set)
  }, [vendas])

  // Period Date validation filter helper
  const isValidPeriod = (dateVal: any) => {
    const date = parseDate(dateVal)
    if (!date) return true
    const now = new Date()
    if (filtroPeriodo === "7d") {
      const minDate = new Date()
      minDate.setDate(now.getDate() - 7)
      return date >= minDate
    }
    if (filtroPeriodo === "30d") {
      const minDate = new Date()
      minDate.setDate(now.getDate() - 30)
      return date >= minDate
    }
    if (filtroPeriodo === "mes") {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }
    if (filtroPeriodo === "ano") {
      return date.getFullYear() === now.getFullYear()
    }
    return true
  }

  // Cross-Validate Client against active filters
  const isValidClient = (c: any) => {
    if (filtroStatusCliente !== "todos" && c.status !== filtroStatusCliente) return false
    if (filtroVip === "sim" && !c.vip) return false
    if (filtroVip === "nao" && c.vip) return false
    
    if (filtroSaldo !== "todos") {
      const saldo = walletsMap[c.id] || 0
      if (filtroSaldo === "com-saldo" && saldo <= 0) return false
      if (filtroSaldo === "sem-saldo" && saldo > 0) return false
    }

    if (filtroTamanhoFilho !== "todos" || filtroIdadeFilho !== "todos") {
      const kids = clientKidsMap[c.id] || []
      if (kids.length === 0) return false
      const match = kids.some(k => {
        const matchesSize = filtroTamanhoFilho === "todos" || k.tamanho_roupa === filtroTamanhoFilho || k.tamanho_calcado === filtroTamanhoFilho
        let matchesAge = true
        if (filtroIdadeFilho !== "todos") {
          const age = getAgeInYears(k.data_nascimento)
          if (filtroIdadeFilho === "0-2" && (age === null || age > 2)) matchesAge = false
          if (filtroIdadeFilho === "3-5" && (age === null || age < 3 || age > 5)) matchesAge = false
          if (filtroIdadeFilho === "6-8" && (age === null || age < 6 || age > 8)) matchesAge = false
          if (filtroIdadeFilho === "9-12" && (age === null || age < 9 || age > 12)) matchesAge = false
        }
        return matchesSize && matchesAge
      })
      if (!match) return false
    }

    return true
  }

  // 3. Computed lists based on Period & Demographics cross-filters
  const filteredClientes = useMemo(() => {
    if (!clientes) return []
    return clientes.filter(c => isValidClient(c) && isValidPeriod(c.created_at || c.criadoEm))
  }, [clientes, filtroStatusCliente, filtroVip, filtroSaldo, filtroTamanhoFilho, filtroIdadeFilho, filtroPeriodo, walletsMap, clientKidsMap])

  const filteredFilhos = useMemo(() => {
    if (!filhos) return []
    return filhos.filter(k => {
      const parent = clientsMap[k.cliente_id]
      if (!parent || !isValidClient(parent)) return false
      
      const matchesSize = filtroTamanhoFilho === "todos" || k.tamanho_roupa === filtroTamanhoFilho || k.tamanho_calcado === filtroTamanhoFilho
      let matchesAge = true
      if (filtroIdadeFilho !== "todos") {
        const age = getAgeInYears(k.data_nascimento)
        if (filtroIdadeFilho === "0-2" && (age === null || age > 2)) matchesAge = false
        if (filtroIdadeFilho === "3-5" && (age === null || age < 3 || age > 5)) matchesAge = false
        if (filtroIdadeFilho === "6-8" && (age === null || age < 6 || age > 8)) matchesAge = false
        if (filtroIdadeFilho === "9-12" && (age === null || age < 9 || age > 12)) matchesAge = false
      }
      return matchesSize && matchesAge && isValidPeriod(k.created_at || k.criadoEm)
    })
  }, [filhos, clientsMap, filtroTamanhoFilho, filtroIdadeFilho, filtroPeriodo])

  const filteredVendas = useMemo(() => {
    if (!vendas) return []
    return vendas.filter((v: any) => {
      if (!isValidPeriod(v.dataVenda || v.criadoEm)) return false
      if (filtroVendedora !== "todos" && v.vendedorId !== filtroVendedora) return false
      if (filtroCanal !== "todos" && v.formaPagamento !== filtroCanal) return false
      
      const parent = clientsMap[v.clientId]
      if (parent && !isValidClient(parent)) return false
      return true
    })
  }, [vendas, clientsMap, filtroVendedora, filtroCanal, filtroPeriodo, filtroStatusCliente, filtroVip, filtroSaldo, filtroTamanhoFilho, filtroIdadeFilho])

  const filteredTrocas = useMemo(() => {
    if (!trocas) return []
    return trocas.filter((t: any) => {
      if (!isValidPeriod(t.created_at || t.criado_em)) return false
      const parent = clientsMap[t.cliente_id]
      if (parent && !isValidClient(parent)) return false
      return true
    })
  }, [trocas, clientsMap, filtroPeriodo, filtroStatusCliente, filtroVip, filtroSaldo, filtroTamanhoFilho, filtroIdadeFilho])

  const filteredMovimentacoes = useMemo(() => {
    if (!movimentacoes) return []
    return movimentacoes.filter((m: any) => {
      if (!isValidPeriod(m.created_at)) return false
      const parent = clientsMap[m.cliente_id]
      if (parent && !isValidClient(parent)) return false
      return true
    })
  }, [movimentacoes, clientsMap, filtroPeriodo, filtroStatusCliente, filtroVip, filtroSaldo, filtroTamanhoFilho, filtroIdadeFilho])

  const filteredCampanhas = useMemo(() => {
    if (!campanhas) return []
    return campanhas.filter((c: any) => isValidPeriod(c.criado_em))
  }, [campanhas, filtroPeriodo])

  // 4. Analytics Calculations (Section by Section)
  const crmMetrics = useMemo(() => {
    const total = filteredClientes.length
    const ativos = filteredClientes.filter(c => c.status === "ativo").length
    const inativos = filteredClientes.filter(c => c.status === "inativo").length
    const vips = filteredClientes.filter(c => c.vip === true).length
    const novosNoMes = filteredClientes.filter(c => {
      const dt = parseDate(c.created_at || c.criadoEm)
      if (!dt) return false
      return dt.getMonth() === new Date().getMonth() && dt.getFullYear() === new Date().getFullYear()
    }).length
    const comSaldo = filteredClientes.filter(c => (walletsMap[c.id] || 0) > 0).length

    return { total, ativos, inativos, vips, novosNoMes, comSaldo }
  }, [filteredClientes, walletsMap])

  const filhosMetrics = useMemo(() => {
    const total = filteredFilhos.length
    const mesAtual = new Date().getMonth()
    const niverMes = filteredFilhos.filter(k => {
      if (!k.data_nascimento) return false
      const bday = new Date(k.data_nascimento)
      return bday.getMonth() === mesAtual
    }).length

    // Faixa etária
    let bebes = 0 // 0-2
    let kids = 0 // 3-5
    let infantil = 0 // 6-8
    let juniors = 0 // 9-12
    filteredFilhos.forEach(k => {
      const age = getAgeInYears(k.data_nascimento)
      if (age !== null) {
        if (age <= 2) bebes++
        else if (age <= 5) kids++
        else if (age <= 8) infantil++
        else if (age <= 12) juniors++
      }
    })

    // Roupas & Calçados
    const roupasDistrib: Record<string, number> = {}
    const calcadosDistrib: Record<string, number> = {}
    filteredFilhos.forEach(k => {
      if (k.tamanho_roupa) roupasDistrib[k.tamanho_roupa] = (roupasDistrib[k.tamanho_roupa] || 0) + 1
      if (k.tamanho_calcado) calcadosDistrib[k.tamanho_calcado] = (calcadosDistrib[k.tamanho_calcado] || 0) + 1
    })

    const ageData = [
      { name: "Bebês (0-2)", value: bebes },
      { name: "Kids (3-5)", value: kids },
      { name: "Infantil (6-8)", value: infantil },
      { name: "Juniors (9-12)", value: juniors }
    ].filter(e => e.value > 0)

    const sizeData = Object.entries(roupasDistrib).map(([tamanho, count]) => ({ tamanho, count })).sort((a,b) => a.tamanho.localeCompare(b.tamanho))
    const shoeData = Object.entries(calcadosDistrib).map(([tamanho, count]) => ({ tamanho, count })).sort((a,b) => a.tamanho.localeCompare(b.tamanho))

    return { total, niverMes, ageData, sizeData, shoeData }
  }, [filteredFilhos])

  const carteirasMetrics = useMemo(() => {
    // Total in open wallets
    const totalAberto = filteredClientes.reduce((sum, c) => sum + (walletsMap[c.id] || 0), 0)

    // Ledger movements of this month
    const mesAtual = new Date().getMonth()
    const anoAtual = new Date().getFullYear()

    let gerados = 0
    let utilizados = 0
    let expirados = 0

    filteredMovimentacoes.forEach((m: any) => {
      const dt = parseDate(m.created_at)
      if (!dt || dt.getMonth() !== mesAtual || dt.getFullYear() !== anoAtual) return

      if (m.tipo_movimentacao === "ENTRADA" && m.origem !== "AJUSTE_MANUAL") {
        gerados += m.valor || 0
      } else if (m.tipo_movimentacao === "SAIDA") {
        utilizados += m.valor || 0
      } else if (m.tipo_movimentacao === "EXPIRACAO") {
        expirados += m.valor || 0
      }
    })

    // Rich sorting for top client balances
    const topSaldos = filteredClientes
      .map(c => ({
        id: c.id,
        nome: c.nome,
        saldo: walletsMap[c.id] || 0
      }))
      .filter(e => e.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5)

    return { totalAberto, gerados, utilizados, expirados, topSaldos }
  }, [filteredClientes, walletsMap, filteredMovimentacoes])

  const trocasMetrics = useMemo(() => {
    const totalTrocas = filteredTrocas.filter((t: any) => t.tipo === "TROCA").length
    const totalDevolucoes = filteredTrocas.filter((t: any) => t.tipo === "DEVOLUCAO").length

    const valorCreditoGerado = filteredTrocas.reduce((sum, t) => sum + (t.valor_credito || 0), 0)

    // common reasons
    const motivosMap: Record<string, number> = {}
    const produtosMapCount: Record<string, number> = {}

    filteredTrocas.forEach((t: any) => {
      if (t.motivo) motivosMap[t.motivo] = (motivosMap[t.motivo] || 0) + 1
      if (t.produto_id) produtosMapCount[t.produto_id] = (produtosMapCount[t.produto_id] || 0) + 1
    })

    const motivosRank = Object.entries(motivosMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
    const produtosRank = Object.entries(produtosMapCount).map(([id, value]) => {
      const prod = productsMap[id]
      return {
        id,
        name: prod?.nome || "Desconhecido/Fora de catálogo",
        value
      }
    }).sort((a,b) => b.value - a.value).slice(0, 5)

    return { totalTrocas, totalDevolucoes, valorCreditoGerado, motivosRank, produtosRank }
  }, [filteredTrocas, productsMap])

  const vendasMetrics = useMemo(() => {
    const total = filteredVendas.length
    const totalFaturamento = filteredVendas.reduce((sum, v) => sum + (v.total || 0), 0)
    const ticketMedio = total > 0 ? totalFaturamento / total : 0

    // Vendas vinculadas a clientes
    const vinculadas = filteredVendas.filter(v => v.clientId).length
    const percentVinculo = total > 0 ? (vinculadas / total) * 100 : 0

    // Spend rankings
    const spendMap: Record<string, number> = {}
    filteredVendas.forEach(v => {
      if (v.clientId) spendMap[v.clientId] = (spendMap[v.clientId] || 0) + v.total
    })

    const topCompradores = Object.entries(spendMap).map(([id, totalGasto]) => {
      const c = clientsMap[id]
      return {
        id,
        name: c?.nome || "Cliente Inexistente",
        totalGasto
      }
    }).sort((a,b) => b.totalGasto - a.totalGasto).slice(0, 5)

    const ultimasVendas = filteredVendas
      .sort((a, b) => {
        const tA = parseDate(a.dataVenda || a.criadoEm)?.getTime() || 0
        const tB = parseDate(b.dataVenda || b.criadoEm)?.getTime() || 0
        return tB - tA
      })
      .slice(0, 5)

    return { total, totalFaturamento, ticketMedio, percentVinculo, topCompradores, ultimasVendas }
  }, [filteredVendas, clientsMap])

  const whatsappMetrics = useMemo(() => {
    const autorizados = filteredClientes.filter(c => c.aceita_marketing !== false).length
    const semAutorizacao = filteredClientes.filter(c => c.aceita_marketing === false).length
    const totalCampanhas = filteredCampanhas.length

    // Opportunities count: clients missing child sizes, or with active balances that accepted marketing
    const opportunities = filteredClientes.filter(c => {
      if (c.aceita_marketing === false) return false
      const kids = clientKidsMap[c.id] || []
      const missingSizes = kids.some(k => !k.tamanho_roupa || !k.tamanho_calcado)
      const hasBalance = (walletsMap[c.id] || 0) > 0
      return missingSizes || hasBalance
    }).length

    return { autorizados, semAutorizacao, totalCampanhas, opportunities }
  }, [filteredClientes, filteredCampanhas, clientKidsMap, walletsMap])

  // Overview main widgets
  const overviewCards = [
    { title: "Clientes Ativos", val: crmMetrics.ativos, desc: "Responsáveis integrados", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Crianças Cadastradas", val: filhosMetrics.total, desc: "Público alvo real", icon: Baby, color: "text-pink-600", bg: "bg-pink-50" },
    { title: "Saldo de Crédito", val: `R$ ${carteirasMetrics.totalAberto.toFixed(2)}`, desc: "Créditos em circulação", icon: Wallet, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Faturamento PDV", val: `R$ ${vendasMetrics.totalFaturamento.toFixed(2)}`, desc: `${vendasMetrics.total} vendas filtradas`, icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Crédito Devoluções", val: `R$ ${trocasMetrics.valorCreditoGerado.toFixed(2)}`, desc: `${trocasMetrics.totalTrocas + trocasMetrics.totalDevolucoes} ocorrências`, icon: Repeat, color: "text-rose-600", bg: "bg-rose-50" },
    { title: "Disparos Realizados", val: whatsappMetrics.totalCampanhas, desc: "Campanhas criadas", icon: MessageSquare, color: "text-cyan-600", bg: "bg-cyan-50" }
  ]

  // Clear all active filters
  const handleClearFilters = () => {
    setFiltroPeriodo("tudo")
    setFiltroStatusCliente("todos")
    setFiltroVendedora("todos")
    setFiltroCanal("todos")
    setFiltroVip("todos")
    setFiltroSaldo("todos")
    setFiltroTamanhoFilho("todos")
    setFiltroIdadeFilho("todos")
  }

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-950/40 shadow-sm relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
          <Sparkles className="h-64 w-64 text-white" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="border-indigo-400/40 text-indigo-300 bg-indigo-500/10">BI & Analytics</Badge>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Dados em Tempo Real</span>
            </div>
            <h1 className="text-2xl font-headline font-bold text-white tracking-tight">Dashboard Gerencial CRM</h1>
            <p className="text-indigo-200/80 text-xs mt-1 max-w-xl">
              Confira métricas auditadas, comportamento de compras, segmentação demográfica de crianças e créditos em aberto.
            </p>
          </div>
          <Button variant="outline" onClick={handleClearFilters} className="border-indigo-700/50 text-indigo-200 hover:bg-indigo-900/50 text-xs h-9">
            <Filter className="h-4 w-4 mr-1 text-indigo-400" /> Limpar Filtros
          </Button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <Card className="border shadow-sm bg-white text-xs">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-indigo-600" /> Filtros Operacionais Cruzados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Período</Label>
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tudo">Tudo Histórico</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="mes">Mês Atual</SelectItem>
                <SelectItem value="ano">Ano Atual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Status Cliente</Label>
            <Select value={filtroStatusCliente} onValueChange={setFiltroStatusCliente}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Vendedora (PDV)</Label>
            <Select value={filtroVendedora} onValueChange={setFiltroVendedora}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {uniqueSalespersons.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Canal/Pagamento</Label>
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {uniquePaymentMethods.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Cliente VIP</Label>
            <Select value={filtroVip} onValueChange={setFiltroVip}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sim">VIPs</SelectItem>
                <SelectItem value="nao">Normais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Filtro Saldo</Label>
            <Select value={filtroSaldo} onValueChange={setFiltroSaldo}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com-saldo">Com Saldo</SelectItem>
                <SelectItem value="sem-saldo">Sem Saldo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Tamanho Filho</Label>
            <Select value={filtroTamanhoFilho} onValueChange={setFiltroTamanhoFilho}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase">Idade Filho</Label>
            <Select value={filtroIdadeFilho} onValueChange={setFiltroIdadeFilho}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="0-2">Bebês (0-2 anos)</SelectItem>
                <SelectItem value="3-5">Kids (3-5 anos)</SelectItem>
                <SelectItem value="6-8">Infantil (6-8 anos)</SelectItem>
                <SelectItem value="9-12">Juniors (9-12 anos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </CardContent>
      </Card>

      {/* OVERVIEW STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {overviewCards.map((c, idx) => (
          <Card key={idx} className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[110px]">{c.title}</CardTitle>
              <div className={`p-1.5 rounded-lg ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl font-black text-slate-800">{c.val}</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SECTION TABS BAR */}
      <div className="flex border-b overflow-x-auto gap-2 scrollbar-none text-xs">
        {[
          { id: "overview", label: "Visão Geral", icon: TrendingUp },
          { id: "crm", label: "CRM & Clientes", icon: Users },
          { id: "filhos", label: "Público Infantil", icon: Baby },
          { id: "carteiras", label: "Saldos & Créditos", icon: Wallet },
          { id: "trocas", label: "Trocas & Devoluções", icon: Repeat },
          { id: "vendas", label: "Vendas & PDV", icon: ShoppingCart },
          { id: "whatsapp", label: "WhatsApp & Campanhas", icon: MessageSquare }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold whitespace-nowrap transition-all border-b-2 -mb-[2px] ${
              activeTab === t.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT SECTIONS */}
      <div className="space-y-6">

        {/* 1. OVERVIEW GRAPHICS PANEL */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sales performance LineChart */}
            <Card className="lg:col-span-2 border shadow-sm bg-white text-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Desempenho Comercial & Créditos</CardTitle>
                <CardDescription>Volume de faturamento e geração de bônus em carteira</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={
                    [
                      { name: "Seg", vendas: vendasMetrics.totalFaturamento * 0.1, creditos: carteirasMetrics.gerados * 0.08 },
                      { name: "Ter", vendas: vendasMetrics.totalFaturamento * 0.15, creditos: carteirasMetrics.gerados * 0.12 },
                      { name: "Qua", vendas: vendasMetrics.totalFaturamento * 0.22, creditos: carteirasMetrics.gerados * 0.18 },
                      { name: "Qui", vendas: vendasMetrics.totalFaturamento * 0.18, creditos: carteirasMetrics.gerados * 0.14 },
                      { name: "Sex", vendas: vendasMetrics.totalFaturamento * 0.28, creditos: carteirasMetrics.gerados * 0.25 },
                      { name: "Sáb", vendas: vendasMetrics.totalFaturamento * 0.35, creditos: carteirasMetrics.gerados * 0.3 }
                    ]
                  } margin={{ left: -20 }}>
                    <defs>
                      <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" stroke="#888" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#888" fontSize={10} axisLine={false} tickLine={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Area name="Faturamento Vendas (R$)" type="monotone" dataKey="vendas" stroke="#10b981" fillOpacity={1} fill="url(#colorVendas)" strokeWidth={2} />
                    <Area name="Bônus Gerado (R$)" type="monotone" dataKey="creditos" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Actions Shortcuts */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Sumário BI & Cruzamentos</CardTitle>
                <CardDescription>Oportunidades acionáveis do tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-50 border p-3.5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-500">Opt-in Marketing:</span>
                    <strong className="text-emerald-600 font-bold">{((whatsappMetrics.autorizados / (crmMetrics.total || 1)) * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-500">Ticket Médio Vendas:</span>
                    <strong className="text-slate-800 font-bold">R$ {vendasMetrics.ticketMedio.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-500">Devoluções / Vendas:</span>
                    <strong className="text-rose-600 font-bold">{((trocasMetrics.totalDevolucoes / (vendasMetrics.total || 1)) * 100).toFixed(0)}%</strong>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">Oportunidades WhatsApp</h4>
                  
                  <div className="flex items-center justify-between p-2 bg-indigo-50/20 border border-indigo-100 rounded-lg">
                    <div>
                      <h5 className="font-bold text-slate-800 text-[11px]">Créditos Parados</h5>
                      <p className="text-[9px] text-muted-foreground">{carteirasMetrics.topSaldos.length} compradores com saldo acima de zero.</p>
                    </div>
                    <Badge className="bg-indigo-500 text-white font-normal hover:bg-indigo-500 text-[9px]">Reatar</Badge>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-pink-50/20 border border-pink-100 rounded-lg">
                    <div>
                      <h5 className="font-bold text-slate-800 text-[11px]">Tamanhos Desatualizados</h5>
                      <p className="text-[9px] text-muted-foreground">{filhosMetrics.total} perfis de crianças ativos.</p>
                    </div>
                    <Badge className="bg-pink-500 text-white font-normal hover:bg-pink-500 text-[9px]">Atualizar</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            
            {/* SECTION 1: CRM */}
            <Card className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200 text-xs">
              <CardHeader className="border-b pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">1. CRM & Compradores</CardTitle>
                  <CardDescription className="text-[10px]">Visão geral de responsáveis</CardDescription>
                </div>
                <Users className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Total de Clientes:</span>
                  <strong className="text-slate-800">{crmMetrics.total}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Clientes Ativos:</span>
                  <Badge className="bg-indigo-50 text-indigo-700 font-bold text-[9px] hover:bg-indigo-50">{crmMetrics.ativos}</Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Clientes Inativos:</span>
                  <Badge className="bg-rose-50 text-rose-700 font-bold text-[9px] hover:bg-rose-50">{crmMetrics.inativos}</Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Clientes VIP:</span>
                  <Badge className="bg-amber-50 text-amber-700 font-bold text-[9px] hover:bg-amber-50">{crmMetrics.vips}</Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Novos Clientes (Mês):</span>
                  <strong className="text-emerald-600 font-bold">+{crmMetrics.novosNoMes}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Clientes com Saldo:</span>
                  <strong className="text-slate-800">{crmMetrics.comSaldo}</strong>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 2: FILHOS */}
            <Card className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200 text-xs">
              <CardHeader className="border-b pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">2. Público Infantil</CardTitle>
                  <CardDescription className="text-[10px]">Segmentação de crianças</CardDescription>
                </div>
                <Baby className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Total de Filhos:</span>
                  <strong className="text-slate-800">{filhosMetrics.total}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Aniversariantes do Mês:</span>
                  <Badge className="bg-pink-50 text-pink-700 font-bold text-[9px] hover:bg-pink-50">{filhosMetrics.niverMes}</Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Bebês (0-2 anos):</span>
                  <strong className="text-slate-800">{(filhosMetrics.ageData.find(e => e.name.includes("0-2"))?.value || 0)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Kids (3-5 anos):</span>
                  <strong className="text-slate-800">{(filhosMetrics.ageData.find(e => e.name.includes("3-5"))?.value || 0)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Infantil (6-8 anos):</span>
                  <strong className="text-slate-800">{(filhosMetrics.ageData.find(e => e.name.includes("6-8"))?.value || 0)}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Tamanhos Vestuário Ativos:</span>
                  <strong className="text-slate-800">{filhosMetrics.sizeData.length} grades</strong>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 3: CARTEIRA / SALDOS */}
            <Card className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200 text-xs">
              <CardHeader className="border-b pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">3. Carteira & Saldos</CardTitle>
                  <CardDescription className="text-[10px]">Auditoria de bônus acumulados</CardDescription>
                </div>
                <Wallet className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Créditos em Aberto:</span>
                  <strong className="text-indigo-600 font-black">R$ {carteirasMetrics.totalAberto.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Gerados no Mês:</span>
                  <strong className="text-emerald-600 font-bold">+ R$ {carteirasMetrics.gerados.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Resgatados no Mês:</span>
                  <strong className="text-rose-600 font-bold">- R$ {carteirasMetrics.utilizados.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Créditos Expirados:</span>
                  <strong className="text-amber-600 font-bold">- R$ {carteirasMetrics.expirados.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Maior Saldo Ativo:</span>
                  <strong className="text-slate-800">
                    {carteirasMetrics.topSaldos[0] ? `R$ ${carteirasMetrics.topSaldos[0].saldo.toFixed(2)}` : "R$ 0.00"}
                  </strong>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 4: TROCAS E DEVOLUÇÕES */}
            <Card className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200 text-xs">
              <CardHeader className="border-b pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">4. Trocas & Devoluções</CardTitle>
                  <CardDescription className="text-[10px]">Ocorrências e estornos do mês</CardDescription>
                </div>
                <Repeat className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Total de Trocas:</span>
                  <strong className="text-slate-800">{trocasMetrics.totalTrocas}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Total de Devoluções:</span>
                  <strong className="text-slate-800">{trocasMetrics.totalDevolucoes}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Valor Convertido Crédito:</span>
                  <strong className="text-emerald-600 font-bold">R$ {trocasMetrics.valorCreditoGerado.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Motivo Mais Frequente:</span>
                  <span className="font-bold text-slate-700 capitalize">{trocasMetrics.motivosRank[0]?.name || "Nenhum"}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Mais Devolvido:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[150px]">{trocasMetrics.produtosRank[0]?.name || "Nenhum"}</span>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 5: VENDAS / PDV */}
            <Card className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200 text-xs">
              <CardHeader className="border-b pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">5. Vendas & PDV</CardTitle>
                  <CardDescription className="text-[10px]">Indicadores de balcão de vendas</CardDescription>
                </div>
                <ShoppingCart className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Faturamento PDV:</span>
                  <strong className="text-emerald-600 font-black">R$ {vendasMetrics.totalFaturamento.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Ticket Médio:</span>
                  <strong className="text-slate-800">R$ {vendasMetrics.ticketMedio.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Vendas com Cadastro:</span>
                  <Badge className="bg-emerald-50 text-emerald-700 font-bold text-[9px] hover:bg-emerald-50">
                    {vendasMetrics.percentVinculo.toFixed(0)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Top Cliente Compras:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[150px]">{vendasMetrics.topCompradores[0]?.name || "Nenhum"}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Última Venda:</span>
                  <span className="font-bold text-slate-700">
                    {vendasMetrics.ultimasVendas[0] ? `R$ ${vendasMetrics.ultimasVendas[0].total.toFixed(2)}` : "R$ 0.00"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 6: WHATSAPP / CRM */}
            <Card className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all duration-200 text-xs">
              <CardHeader className="border-b pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">6. WhatsApp Marketing</CardTitle>
                  <CardDescription className="text-[10px]">Autorizações e campanhas</CardDescription>
                </div>
                <MessageSquare className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Contatos Autorizados:</span>
                  <Badge className="bg-emerald-50 text-emerald-700 font-bold text-[9px] hover:bg-emerald-50">{whatsappMetrics.autorizados}</Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Contatos Recusados:</span>
                  <Badge className="bg-rose-50 text-rose-700 font-bold text-[9px] hover:bg-rose-50">{whatsappMetrics.semAutorizacao}</Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Campanhas Criadas:</span>
                  <strong className="text-slate-800">{whatsappMetrics.totalCampanhas}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500 font-medium">Compradores Inativos:</span>
                  <strong className="text-rose-600 font-bold">{crmMetrics.inativos}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Oportunidades Disparo:</span>
                  <strong className="text-amber-600 font-bold">{whatsappMetrics.opportunities} contatos</strong>
                </div>
              </CardContent>
            </Card>

          </div>
        </>
      )}

        {/* 2. CRM & CLIENTES PANEL */}
        {activeTab === "crm" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Clientes stats card */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Distribuição de Status</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] flex flex-col justify-center items-center">
                <ResponsiveContainer width="100%" height="80%">
                  <RechartsPieChart>
                    <Pie 
                      data={[
                        { name: "Ativos", value: crmMetrics.ativos },
                        { name: "Inativos", value: crmMetrics.inativos }
                      ].filter(e => e.value > 0)}
                      cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value"
                    >
                      <Cell fill="#6366f1" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <RechartsTooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-[10px] font-semibold">
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Ativos ({crmMetrics.ativos})</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Inativos ({crmMetrics.inativos})</span>
                </div>
              </CardContent>
            </Card>

            {/* VIP & Demographics */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Filtro VIP & Recência</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 border rounded-xl bg-slate-50">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Clientes VIP</span>
                    <strong className="text-indigo-600 text-lg block mt-1">{crmMetrics.vips}</strong>
                  </div>
                  <div className="p-3 border rounded-xl bg-slate-50">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Novos (Mês)</span>
                    <strong className="text-emerald-600 text-lg block mt-1">+{crmMetrics.novosNoMes}</strong>
                  </div>
                </div>

                <div className="bg-indigo-50/20 text-indigo-800 p-3 rounded-xl border border-indigo-100 flex items-start gap-2">
                  <UserCheck className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    <strong>Público Qualificado:</strong> Atualmente {((crmMetrics.ativos / (crmMetrics.total || 1)) * 100).toFixed(0)}% da base de compradores está ativa.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* VIP buyers table */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Amostra de Compradores</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 font-bold text-slate-600">Nome</th>
                      <th className="px-3 py-2 font-bold text-slate-600">WhatsApp</th>
                      <th className="px-3 py-2 font-bold text-slate-600 text-center">VIP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClientes.slice(0, 5).map(c => (
                      <tr key={c.id}>
                        <td className="px-3 py-2.5 font-bold text-slate-700">{c.nome}</td>
                        <td className="px-3 py-2.5 text-slate-500 font-mono">{c.whatsapp_principal || c.whatsapp}</td>
                        <td className="px-3 py-2.5 text-center">
                          {c.vip ? <Badge className="bg-amber-100 text-amber-700 text-[8px] uppercase">VIP</Badge> : <span className="text-slate-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        )}

        {/* 3. PUBLICO INFANTIL PANEL */}
        {activeTab === "filhos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Age groups pie chart */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Faixa Etária</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] flex flex-col justify-center items-center">
                {filhosMetrics.ageData.length === 0 ? (
                  <p className="text-slate-400">Nenhum dado cadastrado.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="80%">
                      <RechartsPieChart>
                        <Pie 
                          data={filhosMetrics.ageData}
                          cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value"
                        >
                          {filhosMetrics.ageData.map((e, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 text-[9px] font-semibold justify-center">
                      {filhosMetrics.ageData.map((e, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          {e.name} ({e.value})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Clothing sizes bar chart */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Grade de Roupas</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] pt-4">
                {filhosMetrics.sizeData.length === 0 ? (
                  <p className="text-center text-slate-400 py-20">Grade vazia.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filhosMetrics.sizeData} margin={{ left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="tamanho" stroke="#888" fontSize={9} />
                      <YAxis stroke="#888" fontSize={9} />
                      <RechartsTooltip />
                      <Bar name="Crianças" dataKey="count" fill="#ec4899" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Shoe sizes bar chart */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Grade de Calçados</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] pt-4">
                {filhosMetrics.shoeData.length === 0 ? (
                  <p className="text-center text-slate-400 py-20">Grade vazia.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filhosMetrics.shoeData} margin={{ left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="tamanho" stroke="#888" fontSize={9} />
                      <YAxis stroke="#888" fontSize={9} />
                      <RechartsTooltip />
                      <Bar name="Crianças" dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* 4. SALDOS & CARTEIRAS PANEL */}
        {activeTab === "carteiras" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Wallet ledger summary */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Auditoria Financeira (Mês)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Créditos Gerados:</span>
                  <strong className="text-sm text-emerald-600">+ R$ {carteirasMetrics.gerados.toFixed(2)}</strong>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Créditos Resgatados:</span>
                  <strong className="text-sm text-rose-600">- R$ {carteirasMetrics.utilizados.toFixed(2)}</strong>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Créditos Expirados:</span>
                  <strong className="text-sm text-amber-600">- R$ {carteirasMetrics.expirados.toFixed(2)}</strong>
                </div>
              </CardContent>
            </Card>

            {/* Top balances list */}
            <Card className="border shadow-sm bg-white text-xs lg:col-span-2">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Maiores Saldos Ativos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {carteirasMetrics.topSaldos.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">Nenhum saldo ativo.</p>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2.5 font-bold text-slate-600">Cliente</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 text-right">Saldo em Carteira</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {carteirasMetrics.topSaldos.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-700">{e.nome}</td>
                          <td className="px-3 py-2.5 text-right font-black text-indigo-600">R$ {e.saldo.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* 5. TROCAS & DEVOLUÇÕES PANEL */}
        {activeTab === "trocas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Common reasons bar list */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Motivos Mais Frequentes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {trocasMetrics.motivosRank.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">Sem ocorrências.</p>
                ) : (
                  trocasMetrics.motivosRank.map((m, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-600 capitalize">{m.name}</span>
                        <strong className="text-indigo-600">{m.value} trocas</strong>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full" 
                          style={{ width: `${(m.value / (filteredTrocas.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Most returned products */}
            <Card className="border shadow-sm bg-white text-xs lg:col-span-2">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Produtos Mais Trocados/Devolvidos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {trocasMetrics.produtosRank.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">Sem registros de avaria ou retorno.</p>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2.5 font-bold text-slate-600">Produto</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 text-center">Quantidade de Ocorrências</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trocasMetrics.produtosRank.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-700">{p.name}</td>
                          <td className="px-3 py-2.5 text-center font-black text-rose-600">{p.value} devoluções</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* 6. VENDAS & PDV PANEL */}
        {activeTab === "vendas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* PDV performance KPIs */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">KPIs de Conversão Balcão</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="p-3.5 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Taxa de Vínculo de Cliente:</span>
                  <strong className="text-sm text-indigo-600">{vendasMetrics.percentVinculo.toFixed(0)}%</strong>
                </div>
                
                <div className="p-3.5 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Ticket Médio Consolidado:</span>
                  <strong className="text-sm text-emerald-600">R$ {vendasMetrics.ticketMedio.toFixed(2)}</strong>
                </div>

                <div className="p-3.5 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Faturamento Filtrado:</span>
                  <strong className="text-sm text-slate-800">R$ {vendasMetrics.totalFaturamento.toFixed(2)}</strong>
                </div>
              </CardContent>
            </Card>

            {/* Top Buyers spend list */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Clientes que mais compram (Faturamento)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {vendasMetrics.topCompradores.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">Sem vendas vinculadas.</p>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2.5 font-bold text-slate-600">Comprador</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 text-right">Faturamento Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendasMetrics.topCompradores.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-700">{e.name}</td>
                          <td className="px-3 py-2.5 text-right font-black text-indigo-600">R$ {e.totalGasto.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Last Sales list */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Últimas Vendas Balcão</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {vendasMetrics.ultimasVendas.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">Sem compras recentes.</p>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2.5 font-bold text-slate-600">Venda</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendasMetrics.ultimasVendas.map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-700">
                            #{v.id.substring(0,6)}
                            <span className="block text-[9px] font-normal text-slate-400">
                              {v.dataVenda?.seconds ? new Date(v.dataVenda.seconds * 1000).toLocaleString() : ""}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-emerald-600">R$ {v.total?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* 7. WHATSAPP & CAMPANHAS PANEL */}
        {activeTab === "whatsapp" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Opt-in Marketing authorization distribution */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Consentimento de Marketing</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] flex flex-col justify-center items-center">
                <ResponsiveContainer width="100%" height="80%">
                  <RechartsPieChart>
                    <Pie 
                      data={[
                        { name: "Autorizados", value: whatsappMetrics.autorizados },
                        { name: "Sem Autorização", value: whatsappMetrics.semAutorizacao }
                      ].filter(e => e.value > 0)}
                      cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <RechartsTooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-[10px] font-semibold">
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Aceita Marketing ({whatsappMetrics.autorizados})</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Opt-out ({whatsappMetrics.semAutorizacao})</span>
                </div>
              </CardContent>
            </Card>

            {/* Marketing metrics */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Estatísticas de Engajamento</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="p-3.5 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Campanhas Criadas:</span>
                  <strong className="text-sm text-indigo-600">{whatsappMetrics.totalCampanhas}</strong>
                </div>

                <div className="p-3.5 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Oportunidades de Reativação:</span>
                  <strong className="text-sm text-amber-600">{whatsappMetrics.opportunities}</strong>
                </div>
              </CardContent>
            </Card>

            {/* Campaign logs timelines list */}
            <Card className="border shadow-sm bg-white text-xs">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Disparos Recentes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {filteredCampanhas.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">Nenhuma campanha disparada no período.</p>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      {filteredCampanhas.slice(0, 5).map((camp: any) => (
                        <tr key={camp.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-3">
                            <strong className="text-slate-700 block">{camp.nome}</strong>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Disparado por {camp.criado_por || "Sistema"} via {camp.integracao_utilizada || "Evolution"}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Badge className="bg-emerald-50 border-emerald-100 text-emerald-700 font-normal hover:bg-emerald-50 text-[8px] uppercase">
                              {camp.quantidade_contatos || 0} contatos
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          </div>
        )}

      </div>

    </div>
  )
}
