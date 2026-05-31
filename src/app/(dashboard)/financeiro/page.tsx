"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/lib/legacy-stubs"
import { collection, query, where } from "@/lib/legacy-firestore-stubs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, startOfMonth, endOfMonth, parseISO, isBefore, isSameMonth, subMonths, startOfDay, getMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Loader2, TrendingUp, TrendingDown, Wallet, AlertCircle, DollarSign } from "lucide-react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from "recharts"
import { PermissionGate } from "@/components/permissions/permission-gate"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ec4899', '#f43f5e']

export default function FinanceiroDashboardPage() {
  const db = useFirestore()
  const today = startOfDay(new Date())
  const currentMonthStart = startOfMonth(today)
  const currentMonthEnd = endOfMonth(today)

  // Queries
  const banksQuery = useMemoFirebase(() => db ? collection(db, "bank_accounts") : null, [db])
  const payablesQuery = useMemoFirebase(() => db ? collection(db, "accounts_payable") : null, [db])
  const receivablesQuery = useMemoFirebase(() => db ? collection(db, "accounts_receivable") : null, [db])
  const chartQuery = useMemoFirebase(() => db ? collection(db, "chart_of_accounts") : null, [db])

  // Data fetching
  const { data: bankAccounts, isLoading: loadingBanks } = useCollection(banksQuery)
  const { data: payables, isLoading: loadingPay } = useCollection(payablesQuery)
  const { data: receivables, isLoading: loadingRec } = useCollection(receivablesQuery)
  const { data: chartOfAccounts } = useCollection(chartQuery)

  const isLoading = loadingBanks || loadingPay || loadingRec

  // Cálculos dos Cards Principais
  const metrics = useMemo(() => {
    let saldoAtual = 0
    let receitasRealizadas = 0
    let despesasRealizadas = 0
    let contasVencidasPagar = 0
    let contasVencidasReceber = 0
    let previsaoReceitas = 0
    let previsaoDespesas = 0

    // Saldo Atual das Contas Bancárias
    if (bankAccounts) {
      bankAccounts.forEach((b: any) => {
        if (b.status === "ACTIVE") saldoAtual += b.currentBalance
      })
    }

    const startStr = format(currentMonthStart, "yyyy-MM-dd")
    const endStr = format(currentMonthEnd, "yyyy-MM-dd")
    const todayStr = format(today, "yyyy-MM-dd")

    if (payables) {
      payables.forEach((p: any) => {
        const amount = Number(p.amount)
        if (p.status === "PAID" && p.paymentDate >= startStr && p.paymentDate <= endStr) {
          despesasRealizadas += amount
        }
        if (p.status === "PENDING") {
          if (p.dueDate < todayStr) contasVencidasPagar += amount
          if (p.dueDate >= todayStr && p.dueDate <= endStr) previsaoDespesas += amount
        }
      })
    }

    if (receivables) {
      receivables.forEach((r: any) => {
        const amount = Number(r.amount)
        if (r.status === "PAID" && r.receiptDate >= startStr && r.receiptDate <= endStr) {
          receitasRealizadas += amount
        }
        if (r.status === "PENDING") {
          if (r.dueDate < todayStr) contasVencidasReceber += amount
          if (r.dueDate >= todayStr && r.dueDate <= endStr) previsaoReceitas += amount
        }
      })
    }

    return {
      saldoAtual,
      receitasRealizadas,
      despesasRealizadas,
      resultadoMes: receitasRealizadas - despesasRealizadas,
      contasVencidasPagar,
      contasVencidasReceber,
      previsaoReceitas,
      previsaoDespesas,
      saldoPrevistoFimMes: saldoAtual + previsaoReceitas - previsaoDespesas
    }
  }, [bankAccounts, payables, receivables, currentMonthStart, currentMonthEnd, today])

  // Gráfico: Receitas x Despesas (Últimos 6 meses)
  const chartEvolucao = useMemo(() => {
    const data: Array<{ name: string; Receitas: number; Despesas: number }> = []
    if (!payables || !receivables) return data

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i)
      const startStr = format(startOfMonth(monthDate), "yyyy-MM-dd")
      const endStr = format(endOfMonth(monthDate), "yyyy-MM-dd")
      
      let rec = 0
      let des = 0

      receivables.forEach((r: any) => {
        if (r.status === "PAID" && r.receiptDate >= startStr && r.receiptDate <= endStr) rec += Number(r.amount)
      })
      payables.forEach((p: any) => {
        if (p.status === "PAID" && p.paymentDate >= startStr && p.paymentDate <= endStr) des += Number(p.amount)
      })

      data.push({
        name: format(monthDate, "MMM/yy", { locale: ptBR }).toUpperCase(),
        Receitas: rec,
        Despesas: des
      })
    }
    return data
  }, [payables, receivables, today])

  // Gráfico: Despesas por Plano de Contas (Mês Atual)
  const chartCategorias = useMemo(() => {
    if (!payables || !chartOfAccounts) return []
    
    const startStr = format(currentMonthStart, "yyyy-MM-dd")
    const endStr = format(currentMonthEnd, "yyyy-MM-dd")
    const categoriesMap: any = {}

    payables.forEach((p: any) => {
      // Considera realizadas e previstas pro mês
      const date = p.status === 'PAID' ? p.paymentDate : p.dueDate
      if (date >= startStr && date <= endStr) {
        const catName = chartOfAccounts.find((c: any) => c.id === p.chartOfAccountId)?.name || "Sem Categoria"
        categoriesMap[catName] = (categoriesMap[catName] || 0) + Number(p.amount)
      }
    })

    return Object.keys(categoriesMap).map(key => ({
      name: key,
      value: categoriesMap[key]
    })).sort((a, b) => b.value - a.value)
  }, [payables, chartOfAccounts, currentMonthStart, currentMonthEnd])

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Dashboard Financeiro</h1>
          <p className="text-muted-foreground">Visão geral do caixa e resultados.</p>
        </div>
      </div>

      {/* Alertas Inteligentes */}
      {(metrics.contasVencidasPagar > 0 || metrics.contasVencidasReceber > 0 || metrics.saldoAtual < 1000) && (
        <div className="flex flex-col gap-2">
          {metrics.contasVencidasPagar > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Atenção: Contas a Pagar Vencidas</p>
                <p className="text-xs">Você possui {formatCurrency(metrics.contasVencidasPagar)} em obrigações vencidas. Regularize para evitar juros.</p>
              </div>
            </div>
          )}
          {metrics.contasVencidasReceber > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-700 p-3 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Alerta de Inadimplência</p>
                <p className="text-xs">Existem {formatCurrency(metrics.contasVencidasReceber)} em contas a receber atrasadas. Inicie a cobrança.</p>
              </div>
            </div>
          )}
          {metrics.saldoAtual < 1000 && (
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 p-3 rounded-lg flex items-center gap-3">
              <Wallet className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Alerta de Saldo Baixo</p>
                <p className="text-xs">O saldo consolidado de suas contas está abaixo da margem de segurança (R$ 1.000,00).</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linha 1: Cartões Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PermissionGate modulo="Financeiro" acao="ver_saldos_bancarios" fallback={
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex justify-between items-center text-primary-foreground/80">
                Saldo Atual em Contas <Wallet className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ ••••••</div>
              <p className="text-xs text-primary-foreground/70 mt-1">Acesso restrito</p>
            </CardContent>
          </Card>
        }>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex justify-between items-center text-primary-foreground/80">
                Saldo Atual em Contas <Wallet className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(metrics.saldoAtual)}</div>
              <p className="text-xs text-primary-foreground/70 mt-1">Soma de todas as contas ativas</p>
            </CardContent>
          </Card>
        </PermissionGate>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between items-center text-muted-foreground">
              Receitas (Realizado) <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.receitasRealizadas)}</div>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between items-center text-muted-foreground">
              Despesas (Realizado) <TrendingDown className="h-4 w-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(metrics.despesasRealizadas)}</div>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <PermissionGate modulo="Financeiro" acao="ver_lucro" fallback={
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex justify-between items-center text-muted-foreground">
                Resultado do Mês <DollarSign className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">R$ ••••••</div>
              <p className="text-xs text-muted-foreground mt-1">Acesso restrito</p>
            </CardContent>
          </Card>
        }>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex justify-between items-center text-muted-foreground">
                Resultado do Mês <DollarSign className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.resultadoMes >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(metrics.resultadoMes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Receitas - Despesas</p>
            </CardContent>
          </Card>
        </PermissionGate>
      </div>

      {/* Linha 2: Avisos e Previsão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" /> Contas Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">A Pagar</p>
                <div className="text-lg font-bold text-destructive">{formatCurrency(metrics.contasVencidasPagar)}</div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">A Receber</p>
                <div className="text-lg font-bold text-orange-500">{formatCurrency(metrics.contasVencidasReceber)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Previsão de Caixa (Fim do Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-muted-foreground">+ A Receber (Pendente)</p>
                  <div className="text-lg font-semibold text-emerald-600">{formatCurrency(metrics.previsaoReceitas)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">- A Pagar (Pendente)</p>
                  <div className="text-lg font-semibold text-destructive">{formatCurrency(metrics.previsaoDespesas)}</div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Saldo Previsto</p>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.saldoPrevistoFimMes)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 3: Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Receitas e Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartEvolucao} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria (Mês Atual)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {chartCategorias.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">Nenhuma despesa no mês</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartCategorias}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {chartCategorias.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
