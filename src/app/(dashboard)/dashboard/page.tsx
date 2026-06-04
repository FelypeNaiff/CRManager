"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Users, ShoppingBag, TrendingUp, AlertCircle, ArrowRight, Wallet, CalendarDays, Banknote, Building, Loader2 } from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts"
import Link from "next/link"
import { useProfile } from "@/lib/contexts/profile-context"
import { getCustomers } from "@/lib/crm/actions"
import { getFinancialDashboardSummary, getFinancialTransactions } from "@/lib/financial/financial-actions"
import { getDashboardMetricsAction } from "@/lib/reports/actions/commercial-report-actions"
import { listSalesAction } from "@/lib/sales/actions/list-sales-action"

export default function DashboardPage() {
  const { activeProfile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    activeCustomersCount: 0,
    receitasHoje: "R$ 0,00",
    aReceber: "R$ 0,00",
    aPagar: "R$ 0,00",
    bankAccounts: [] as Array<{ banco: string; saldo: string; logo: string }>,
    fluxoCaixaData: [] as Array<{ name: string; entradas: number; saidas: number }>,
    vendasData: [] as Array<{ name: string; total: number }>,
    agenda: [] as Array<{ hora: string; evento: string; tipo: string }>
  })

  useEffect(() => {
    async function loadDashboard() {
      if (!activeProfile?.empresaId) return
      setLoading(true)
      try {
        const today = new Date()
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

        // 1. Clientes Ativos
        const customersRes = await getCustomers()
        const activeCustomersCount = customersRes.success && customersRes.data 
          ? customersRes.data.filter((c: any) => c.status === 'ativo').length
          : 0

        // 2. Resumo Financeiro (Contas, Saldo, Receitas/Despesas do Mês)
        const finSummaryRes = await getFinancialDashboardSummary()
        const financialSummary = finSummaryRes.success && finSummaryRes.data ? finSummaryRes.data : {
          totalBalance: 0,
          bankAccounts: [],
          monthlyIncome: 0,
          monthlyExpense: 0,
          overdueReceivables: { count: 0, total: 0 }
        }

        // 3. Receitas Hoje
        const metricsRes = await getDashboardMetricsAction({
          companyId: activeProfile.empresaId,
          startDate: startOfToday,
          endDate: endOfToday
        })
        const todayRevenue = metricsRes.success && metricsRes.data ? metricsRes.data.grossRevenue : 0

        // 4. Fluxo de Caixa (Últimos 6 meses)
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
        sixMonthsAgo.setDate(1)
        sixMonthsAgo.setHours(0, 0, 0, 0)

        const txsRes = await getFinancialTransactions({
          startDate: sixMonthsAgo.toISOString()
        })

        const monthsList: Array<{ name: string; monthNum: number; year: number; entradas: number; saidas: number }> = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          monthsList.push({
            name: d.toLocaleDateString('pt-BR', { month: 'short' }),
            monthNum: d.getMonth(),
            year: d.getFullYear(),
            entradas: 0,
            saidas: 0
          })
        }

        let overduePayablesTotal = 0

        if (txsRes.success && txsRes.data) {
          txsRes.data.forEach((tx: any) => {
            const txDate = new Date(tx.createdAt)
            const txMonth = txDate.getMonth()
            const txYear = txDate.getFullYear()
            const amount = Number(tx.amount)

            const monthBucket = monthsList.find(m => m.monthNum === txMonth && m.year === txYear)
            if (monthBucket) {
              if (tx.direction === 'IN' && tx.status === 'PAID') {
                monthBucket.entradas += amount
              } else if (tx.direction === 'OUT' && tx.status === 'PAID') {
                monthBucket.saidas += amount
              }
            }

            // Calcular Contas a Pagar em aberto
            if (tx.direction === 'OUT' && tx.status === 'PENDING') {
              overduePayablesTotal += amount
            }
          })
        }

        // 5. Vendas Recentes (Últimos 7 dias)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        const salesRes = await listSalesAction(activeProfile.empresaId, {
          startDate: sevenDaysAgo
        })

        const daysList: Array<{ name: string; dateStr: string; total: number }> = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          daysList.push({
            name: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
            dateStr: d.toDateString(),
            total: 0
          })
        }

        if (salesRes.success && 'data' in salesRes && salesRes.data) {
          const salesList = Array.isArray(salesRes.data) ? salesRes.data : [];
          salesList.forEach((s: any) => {
            const sDate = new Date(s.createdAt)
            const dayBucket = daysList.find(d => d.dateStr === sDate.toDateString())
            if (dayBucket && s.status !== 'CANCELLED') {
              dayBucket.total += Number(s.totalAmount)
            }
          })
        }

        // 6. Contas Bancárias Reais
        const mappedBanks = (financialSummary.bankAccounts || []).map((b: any) => {
          let logo = "bg-gray-500"
          const nameLower = b.name.toLowerCase()
          if (nameLower.includes("itaú") || nameLower.includes("itau")) logo = "bg-orange-500"
          else if (nameLower.includes("bradesco")) logo = "bg-red-600"
          else if (nameLower.includes("nubank")) logo = "bg-purple-600"
          else if (nameLower.includes("caixa")) logo = "bg-blue-600"

          return {
            banco: b.name,
            saldo: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(b.currentBalance)),
            logo
          }
        })

        // 7. Agenda do Dia (Vencimentos pendentes)
        const agendaItems: any[] = []
        if (txsRes.success && txsRes.data) {
          const todayStr = startOfToday.toDateString()
          txsRes.data.forEach((tx: any) => {
            if (tx.status === 'PENDING' && tx.dueDate) {
              const dDate = new Date(tx.dueDate)
              if (dDate.toDateString() === todayStr || dDate < startOfToday) {
                agendaItems.push({
                  hora: dDate.toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) !== "00:00"
                    ? dDate.toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : "Dia todo",
                  evento: tx.description,
                  tipo: tx.type === 'INCOME' ? 'A Receber' : 'Vencimento'
                })
              }
            }
          })
        }

        setDashboardData({
          activeCustomersCount,
          receitasHoje: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(todayRevenue),
          aReceber: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financialSummary.overdueReceivables?.total || 0),
          aPagar: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(overduePayablesTotal),
          bankAccounts: mappedBanks,
          fluxoCaixaData: monthsList.map(m => ({ name: m.name, entradas: m.entradas, saidas: m.saidas })),
          vendasData: daysList.map(d => ({ name: d.name, total: d.total })),
          agenda: agendaItems.slice(0, 5)
        })

      } catch (err) {
        console.error("Erro ao carregar dados do painel:", err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [activeProfile])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-slate-50/50 rounded-xl border border-dashed py-20">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Carregando painel geral...</p>
        </div>
      </div>
    )
  }

  const topCards = [
    { 
      title: "Receitas Hoje", 
      value: dashboardData.receitasHoje, 
      icon: TrendingUp, 
      borderColor: "border-t-[#0073b7]", 
      iconColor: "text-[#0073b7]",
      bgColor: "bg-[#0073b7]/10",
      link: "/pdv" 
    },
    { 
      title: "A Receber", 
      value: dashboardData.aReceber, 
      icon: Banknote, 
      borderColor: "border-t-[#00a65a]", 
      iconColor: "text-[#00a65a]",
      bgColor: "bg-[#00a65a]/10",
      link: "/financeiro/contas-a-receber" 
    },
    { 
      title: "A Pagar", 
      value: dashboardData.aPagar, 
      icon: AlertCircle, 
      borderColor: "border-t-[#dd4b39]", 
      iconColor: "text-[#dd4b39]",
      bgColor: "bg-[#dd4b39]/10",
      link: "/financeiro/contas-a-pagar" 
    },
    { 
      title: "Clientes Ativos", 
      value: String(dashboardData.activeCustomersCount), 
      icon: Users, 
      borderColor: "border-t-primary", 
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      link: "/crm/clientes" 
    },
  ]

  const hasCashFlowData = dashboardData.fluxoCaixaData.some(d => d.entradas > 0 || d.saidas > 0)
  const hasSalesData = dashboardData.vendasData.some(d => d.total > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-headline font-bold text-foreground">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">Acompanhe os principais indicadores do seu negócio.</p>
      </div>

      {/* Top Row - Cards ERP */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card, idx) => (
          <Card key={idx} className={`relative overflow-hidden border-0 shadow-sm border-t-4 ${card.borderColor} rounded-md bg-white`}>
            <div className="absolute right-[-20px] top-[-10px] opacity-10 pointer-events-none">
              <card.icon className="h-32 w-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{card.title}</CardTitle>
              <div className={`p-2 rounded-md ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pb-0">
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
            <CardFooter className="pt-4 pb-3 mt-4 bg-muted/20 border-t relative z-10">
              <Link href={card.link} className="flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors w-full justify-between">
                Ir para {card.title.split(' ')[0]} <ArrowRight className="h-3 w-3" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        
        {/* Fluxo de Caixa */}
        <Card className="lg:col-span-2 border-0 shadow-sm border-t-4 border-t-[#00a65a] rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            {hasCashFlowData ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.fluxoCaixaData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar name="Entradas" dataKey="entradas" fill="#00a65a" radius={[2, 2, 0, 0]} barSize={20} />
                    <Bar name="Saídas" dataKey="saidas" fill="#dd4b39" radius={[2, 2, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-md bg-slate-50/50">
                <p className="text-xs text-muted-foreground">Nenhum fluxo de caixa registrado para este período.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Vendas */}
        <Card className="lg:col-span-1 border-0 shadow-sm border-t-4 border-t-[#0073b7] rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSalesData ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.vendasData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="total" fill="#0073b7" radius={[2, 2, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-md bg-slate-50/50">
                <p className="text-xs text-muted-foreground">Nenhuma venda registrada nos últimos 7 dias.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contas Bancárias */}
        <Card className="lg:col-span-2 border-0 shadow-sm border-t-4 border-t-gray-400 rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building className="h-5 w-5 text-gray-500" /> Saldos em Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.bankAccounts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dashboardData.bankAccounts.map((conta, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-md hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-xs ${conta.logo}`}>
                        {conta.banco.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{conta.banco}</span>
                    </div>
                    <span className="font-bold text-foreground">{conta.saldo}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center border border-dashed rounded-md bg-slate-50/50">
                <p className="text-xs text-muted-foreground">Nenhuma conta bancária cadastrada.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agenda */}
        <Card className="lg:col-span-1 border-0 shadow-sm border-t-4 border-t-[#f39c12] rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#f39c12]" /> Agenda do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.agenda.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.agenda.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative before:absolute before:left-[19px] before:top-6 before:bottom-[-16px] before:w-[2px] before:bg-border last:before:hidden">
                    <div className="w-10 text-xs font-bold text-muted-foreground pt-1 shrink-0 text-right">
                      {item.hora}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#f39c12] mt-2 shrink-0 z-10 ring-4 ring-white" />
                    <div className="bg-muted/30 border rounded-md p-3 flex-1">
                      <p className="text-sm font-semibold">{item.evento}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.tipo}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed rounded-md bg-slate-50/50">
                <p className="text-xs text-muted-foreground">Nenhum compromisso ou vencimento pendente.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Link href="/financeiro/calendario" className="text-sm text-primary font-medium hover:underline w-full text-center">
              Ver calendário completo
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
