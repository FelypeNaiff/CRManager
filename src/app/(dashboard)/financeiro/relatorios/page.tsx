"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, where, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Download, FileSpreadsheet, FileText, Loader2, BarChart3, Target, ArrowDownToLine } from "lucide-react"

export default function RelatoriosPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const db = useFirestore()

  // Queries
  const payablesQuery = useMemoFirebase(() => db ? collection(db, "accounts_payable") : null, [db])
  const receivablesQuery = useMemoFirebase(() => db ? collection(db, "accounts_receivable") : null, [db])
  const chartQuery = useMemoFirebase(() => db ? collection(db, "chart_of_accounts") : null, [db])

  // Data fetching
  const { data: payables, isLoading: loadingPay } = useCollection(payablesQuery)
  const { data: receivables, isLoading: loadingRec } = useCollection(receivablesQuery)
  const { data: chartOfAccounts, isLoading: loadingChart } = useCollection(chartQuery)

  const isLoading = loadingPay || loadingRec || loadingChart

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))

  const dreData = useMemo(() => {
    if (!payables || !receivables || !chartOfAccounts) return null

    const startStr = format(startOfMonth(currentDate), "yyyy-MM-dd")
    const endStr = format(endOfMonth(currentDate), "yyyy-MM-dd")

    const report: any = {
      receitas: { totalRealizado: 0, totalPrevisto: 0, items: {} },
      despesas: { totalRealizado: 0, totalPrevisto: 0, items: {} }
    }

    // Inicializa as categorias no report baseado no plano de contas
    chartOfAccounts.forEach((c: any) => {
      if (c.type === 'REVENUE') {
        report.receitas.items[c.id] = { name: c.name, code: c.code, realizado: 0, previsto: 0 }
      } else {
        report.despesas.items[c.id] = { name: c.name, code: c.code, realizado: 0, previsto: 0 }
      }
    })

    // Processa Receitas
    receivables.forEach((r: any) => {
      const amount = Number(r.amount)
      const catId = r.chartOfAccountId || 'sem-categoria'
      
      if (!report.receitas.items[catId]) {
        report.receitas.items[catId] = { name: "Sem Categoria Especificada", code: "0", realizado: 0, previsto: 0 }
      }

      // Previsto
      if (r.dueDate >= startStr && r.dueDate <= endStr) {
        report.receitas.items[catId].previsto += amount
        report.receitas.totalPrevisto += amount
      }
      // Realizado
      if (r.status === "PAID" && r.receiptDate >= startStr && r.receiptDate <= endStr) {
        report.receitas.items[catId].realizado += amount
        report.receitas.totalRealizado += amount
      }
    })

    // Processa Despesas
    payables.forEach((p: any) => {
      const amount = Number(p.amount)
      const catId = p.chartOfAccountId || 'sem-categoria'
      
      if (!report.despesas.items[catId]) {
        report.despesas.items[catId] = { name: "Sem Categoria Especificada", code: "0", realizado: 0, previsto: 0 }
      }

      // Previsto
      if (p.dueDate >= startStr && p.dueDate <= endStr) {
        report.despesas.items[catId].previsto += amount
        report.despesas.totalPrevisto += amount
      }
      // Realizado
      if (p.status === "PAID" && p.paymentDate >= startStr && p.paymentDate <= endStr) {
        report.despesas.items[catId].realizado += amount
        report.despesas.totalRealizado += amount
      }
    })

    const recItemsArray = Object.values(report.receitas.items).filter((i: any) => i.realizado > 0 || i.previsto > 0).sort((a: any, b: any) => a.code.localeCompare(b.code))
    const desItemsArray = Object.values(report.despesas.items).filter((i: any) => i.realizado > 0 || i.previsto > 0).sort((a: any, b: any) => a.code.localeCompare(b.code))

    return {
      ...report,
      receitasList: recItemsArray,
      despesasList: desItemsArray,
      lucroRealizado: report.receitas.totalRealizado - report.despesas.totalRealizado,
      lucroPrevisto: report.receitas.totalPrevisto - report.despesas.totalPrevisto,
    }
  }, [payables, receivables, chartOfAccounts, currentDate])

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  // Função para exportar CSV genérico
  const exportCSV = () => {
    if (!payables || !receivables) return

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "TIPO,DATA_VENCIMENTO,DATA_PAGAMENTO,DESCRICAO,CATEGORIA,VALOR,STATUS\n"

    receivables.forEach((r: any) => {
      const cat = chartOfAccounts?.find((c: any) => c.id === r.chartOfAccountId)?.name || "Sem Categoria"
      csvContent += `RECEITA,${r.dueDate},${r.receiptDate || ""},"${r.description}","${cat}",${r.amount},${r.status}\n`
    })

    payables.forEach((p: any) => {
      const cat = chartOfAccounts?.find((c: any) => c.id === p.chartOfAccountId)?.name || "Sem Categoria"
      csvContent += `DESPESA,${p.dueDate},${p.paymentDate || ""},"${p.description}","${cat}",${p.amount},${p.status}\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `exportacao_financeira_${format(new Date(), "yyyyMMdd")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Relatórios Gerenciais</h1>
          <p className="text-muted-foreground">DRE, orçamentos e exportação contábil.</p>
        </div>
      </div>

      <Tabs defaultValue="dre" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="dre" className="flex items-center gap-2"><BarChart3 className="h-4 w-4"/> DRE Gerencial</TabsTrigger>
          <TabsTrigger value="orcamento" className="flex items-center gap-2"><Target className="h-4 w-4"/> Orçamento Mensal</TabsTrigger>
          <TabsTrigger value="exportacao" className="flex items-center gap-2"><ArrowDownToLine className="h-4 w-4"/> Exportação Contábil</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dre" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Demonstração do Resultado do Exercício</CardTitle>
                <CardDescription>Visão consolidada de Receitas e Despesas agrupadas pelo Plano de Contas.</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handlePrevMonth}>&laquo; Mês Anterior</Button>
                <span className="font-bold text-lg min-w-[140px] text-center capitalize">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</span>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>Próximo Mês &raquo;</Button>
              </div>
            </CardHeader>
            <CardContent>
              {dreData && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold w-[50%]">Conta Contábil / Descrição</TableHead>
                        <TableHead className="text-right font-bold">Previsto (Competência)</TableHead>
                        <TableHead className="text-right font-bold">Realizado (Caixa)</TableHead>
                        <TableHead className="text-right font-bold">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* RECEITAS */}
                      <TableRow className="bg-emerald-50">
                        <TableCell colSpan={4} className="font-bold text-emerald-800 text-sm py-2 uppercase">1. Receitas Brutas</TableCell>
                      </TableRow>
                      {dreData.receitasList.map((item: any) => (
                        <TableRow key={item.code}>
                          <TableCell className="pl-6 text-sm">{item.code} - {item.name}</TableCell>
                          <TableCell className="text-right text-emerald-600/80">{formatCurrency(item.previsto)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(item.realizado)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{item.previsto > 0 ? ((item.realizado/item.previsto)*100).toFixed(1) : 0}%</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-emerald-100/50">
                        <TableCell className="font-bold text-emerald-900 text-right">TOTAL DE RECEITAS (=)</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(dreData.receitas.totalPrevisto)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(dreData.receitas.totalRealizado)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>

                      {/* DESPESAS */}
                      <TableRow className="bg-orange-50 mt-2">
                        <TableCell colSpan={4} className="font-bold text-orange-800 text-sm py-2 uppercase">2. Despesas e Custos (-)</TableCell>
                      </TableRow>
                      {dreData.despesasList.map((item: any) => (
                        <TableRow key={item.code}>
                          <TableCell className="pl-6 text-sm">{item.code} - {item.name}</TableCell>
                          <TableCell className="text-right text-destructive/80">{formatCurrency(item.previsto)}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">{formatCurrency(item.realizado)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{item.previsto > 0 ? ((item.realizado/item.previsto)*100).toFixed(1) : 0}%</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-orange-100/50">
                        <TableCell className="font-bold text-orange-900 text-right">TOTAL DE DESPESAS (=)</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{formatCurrency(dreData.despesas.totalPrevisto)}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{formatCurrency(dreData.despesas.totalRealizado)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>

                      {/* LUCRO LÍQUIDO */}
                      <TableRow className="bg-blue-100">
                        <TableCell className="font-black text-blue-900 text-right text-lg uppercase py-4">3. Resultado Líquido (Lucro/Prejuízo)</TableCell>
                        <TableCell className={`text-right font-black text-lg ${dreData.lucroPrevisto >= 0 ? 'text-blue-700' : 'text-destructive'}`}>
                          {formatCurrency(dreData.lucroPrevisto)}
                        </TableCell>
                        <TableCell className={`text-right font-black text-lg ${dreData.lucroRealizado >= 0 ? 'text-blue-700' : 'text-destructive'}`}>
                          {formatCurrency(dreData.lucroRealizado)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcamento" className="mt-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Planejamento Orçamentário Mensal</CardTitle>
              <CardDescription>Defina metas de gastos por categoria e acompanhe o percentual consumido em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Target className="h-12 w-12 text-muted mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Módulo em Desenvolvimento</h3>
              <p className="max-w-md">O recurso de criação de orçamentos (Budgets) fixos por centro de custo e plano de contas está sendo preparado para as próximas atualizações do sistema.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exportacao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Exportação de Dados para a Contabilidade</CardTitle>
              <CardDescription>Gere os relatórios em formato CSV e PDF para envio ao seu escritório contábil.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Exportar para Excel (CSV)</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Gera uma planilha completa com todos os lançamentos financeiros detalhados.</p>
                    <Button onClick={exportCSV} className="w-full bg-emerald-600 hover:bg-emerald-700"><Download className="mr-2 h-4 w-4"/> Baixar CSV</Button>
                  </div>
                </div>

                <div className="border p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4 bg-muted/20">
                  <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Exportar DRE (PDF)</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Gera um relatório formal em PDF para apresentação gerencial e balanço.</p>
                    <Button variant="outline" className="w-full" onClick={() => window.print()}><Download className="mr-2 h-4 w-4"/> Imprimir PDF</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
