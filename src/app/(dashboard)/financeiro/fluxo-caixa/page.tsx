"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowUpCircle, ArrowDownCircle, Filter, Download } from "lucide-react"
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function FluxoCaixaPage() {
  const db = useFirestore()
  const today = startOfDay(new Date())

  // Filtros State
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"))
  const [chartAccountId, setChartAccountId] = useState("ALL")
  const [costCenterId, setCostCenterId] = useState("ALL")
  const [bankAccountId, setBankAccountId] = useState("ALL")

  // Queries
  const payablesQuery = useMemoFirebase(() => db ? collection(db, "accounts_payable") : null, [db])
  const receivablesQuery = useMemoFirebase(() => db ? collection(db, "accounts_receivable") : null, [db])
  const chartQuery = useMemoFirebase(() => db ? collection(db, "chart_of_accounts") : null, [db])
  const costCentersQuery = useMemoFirebase(() => db ? collection(db, "cost_centers") : null, [db])
  const banksQuery = useMemoFirebase(() => db ? collection(db, "bank_accounts") : null, [db])

  // Data fetching
  const { data: payables, isLoading: loadingPay } = useCollection(payablesQuery)
  const { data: receivables, isLoading: loadingRec } = useCollection(receivablesQuery)
  const { data: chartOfAccounts } = useCollection(chartQuery)
  const { data: costCenters } = useCollection(costCentersQuery)
  const { data: bankAccounts } = useCollection(banksQuery)

  const isLoading = loadingPay || loadingRec

  // Lógica do Fluxo de Caixa
  const flowData = useMemo(() => {
    let entradasRealizadas = 0
    let saidasRealizadas = 0
    let entradasPrevistas = 0
    let saidasPrevistas = 0
    
    // Para calcular saldo inicial teórico do período, pegaríamos transações anteriores à startDate.
    // Como a base pode ser grande, faremos um fluxo simples no período.
    let saldoInicial = 0 
    if (bankAccounts) {
      // Saldo Inicial Aproximado = Saldo Atual - (Realizado no período e Realizado futuro)
      // Idealmente o fluxo de caixa constrói o saldo progressivamente dia a dia desde a fundação da empresa.
      // Aqui simplificaremos exibindo apenas as Entradas e Saídas do Período, assumindo Saldo Anterior = 0 provisoriamente
      // numa aplicação real, criaríamos um endpoint de conciliação.
    }

    const items: any[] = []

    if (payables) {
      payables.forEach((p: any) => {
        // Filtragem
        if (chartAccountId !== "ALL" && p.chartOfAccountId !== chartAccountId) return
        if (costCenterId !== "ALL" && p.costCenterId !== costCenterId) return
        if (bankAccountId !== "ALL" && p.bankAccountId !== bankAccountId) return

        const amount = Number(p.amount)
        const dateRealized = p.paymentDate
        const dateExpected = p.dueDate

        // Realizado
        if (p.status === "PAID" && dateRealized >= startDate && dateRealized <= endDate) {
          saidasRealizadas += amount
          items.push({ ...p, displayDate: dateRealized, type: 'SAIDA', isRealized: true })
        }
        // Previsto
        if (dateExpected >= startDate && dateExpected <= endDate) {
          saidasPrevistas += amount
          if (p.status === "PENDING") {
             items.push({ ...p, displayDate: dateExpected, type: 'SAIDA', isRealized: false })
          }
        }
      })
    }

    if (receivables) {
      receivables.forEach((r: any) => {
        // Filtragem
        if (chartAccountId !== "ALL" && r.chartOfAccountId !== chartAccountId) return
        if (costCenterId !== "ALL" && r.costCenterId !== costCenterId) return
        if (bankAccountId !== "ALL" && r.bankAccountId !== bankAccountId) return

        const amount = Number(r.amount)
        const dateRealized = r.receiptDate
        const dateExpected = r.dueDate

        // Realizado
        if (r.status === "PAID" && dateRealized >= startDate && dateRealized <= endDate) {
          entradasRealizadas += amount
          items.push({ ...r, displayDate: dateRealized, type: 'ENTRADA', isRealized: true })
        }
        // Previsto
        if (dateExpected >= startDate && dateExpected <= endDate) {
          entradasPrevistas += amount
          if (r.status === "PENDING") {
             items.push({ ...r, displayDate: dateExpected, type: 'ENTRADA', isRealized: false })
          }
        }
      })
    }

    // Ordenar itens por data
    items.sort((a, b) => a.displayDate.localeCompare(b.displayDate))

    return {
      entradasRealizadas,
      saidasRealizadas,
      saldoFinalRealizado: entradasRealizadas - saidasRealizadas,
      entradasPrevistas,
      saidasPrevistas,
      saldoFinalPrevisto: entradasPrevistas - saidasPrevistas,
      items
    }
  }, [payables, receivables, bankAccounts, startDate, endDate, chartAccountId, costCenterId, bankAccountId])

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">Relatório de entradas e saídas financeiras do período (Previsto x Realizado).</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Exportar Relatório
        </Button>
      </div>

      {/* Painel de Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <Label>Data Inicial</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Data Final</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Conta Bancária</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Todas as contas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as contas</SelectItem>
                {(bankAccounts || []).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Plano de Contas</Label>
            <Select value={chartAccountId} onValueChange={setChartAccountId}>
              <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as categorias</SelectItem>
                {(chartOfAccounts || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Centro de Custo</Label>
            <Select value={costCenterId} onValueChange={setCostCenterId}>
              <SelectTrigger><SelectValue placeholder="Todos os centros" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os centros</SelectItem>
                {(costCenters || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Período */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Realizado */}
        <Card className="border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle>Fluxo Realizado (Pagos/Recebidos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-emerald-600">
                <span className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4"/> Entradas Reais</span>
                <span className="font-bold">{formatCurrency(flowData.entradasRealizadas)}</span>
              </div>
              <div className="flex justify-between items-center text-destructive">
                <span className="flex items-center gap-2"><ArrowDownCircle className="h-4 w-4"/> Saídas Reais</span>
                <span className="font-bold">{formatCurrency(flowData.saidasRealizadas)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center font-bold text-lg">
                <span>Geração de Caixa Real:</span>
                <span className={flowData.saldoFinalRealizado >= 0 ? "text-emerald-600" : "text-destructive"}>
                  {formatCurrency(flowData.saldoFinalRealizado)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Previsto */}
        <Card className="border-t-4 border-t-blue-500 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle>Fluxo Previsto (Competência Original)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-blue-600">
                <span className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4"/> Receitas Previstas</span>
                <span className="font-bold">{formatCurrency(flowData.entradasPrevistas)}</span>
              </div>
              <div className="flex justify-between items-center text-orange-500">
                <span className="flex items-center gap-2"><ArrowDownCircle className="h-4 w-4"/> Despesas Previstas</span>
                <span className="font-bold">{formatCurrency(flowData.saidasPrevistas)}</span>
              </div>
              <div className="border-t pt-3 border-blue-200 flex justify-between items-center font-bold text-lg">
                <span>Projeção Final:</span>
                <span className={flowData.saldoFinalPrevisto >= 0 ? "text-blue-600" : "text-orange-600"}>
                  {formatCurrency(flowData.saldoFinalPrevisto)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Lançamentos */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : flowData.items.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">Nenhuma movimentação para os filtros selecionados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Pessoa / Conta</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flowData.items.map((item: any) => {
                  const isEntrada = item.type === 'ENTRADA'
                  return (
                    <TableRow key={item.id + item.isRealized}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(parseISO(item.displayDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {isEntrada ? item.clientName : item.supplierName}
                      </TableCell>
                      <TableCell>
                        {item.isRealized ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none">Realizado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Previsto (Pendente)</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isEntrada ? 'text-emerald-600' : ''}`}>
                        {isEntrada ? formatCurrency(item.amount) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${!isEntrada ? 'text-destructive' : ''}`}>
                        {!isEntrada ? formatCurrency(item.amount) : "-"}
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
  )
}
