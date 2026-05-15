"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Search, Plus, Loader2, Users, Receipt, Wallet, ArrowDownCircle, Printer, CheckCircle2
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const emptyForm = {
  employeeName: "",
  type: "ADIANTAMENTO",
  amount: 0,
  installments: 1,
  bankAccountId: "",
  date: format(new Date(), "yyyy-MM-dd"),
  notes: "",
}

export default function ValesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false)
  
  const [form, setForm] = useState(emptyForm)
  const [selectedVale, setSelectedVale] = useState<any>(null)
  const [discountAmount, setDiscountAmount] = useState<number | string>("")
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()

  // Queries
  const valesQuery = useMemoFirebase(() => db ? collection(db, "employee_advances") : null, [db])
  const banksQuery = useMemoFirebase(() => db ? collection(db, "bank_accounts") : null, [db])

  // Fetching
  const { data: valesRaw, isLoading: loadingVales } = useCollection(valesQuery)
  const { data: bankAccounts } = useCollection(banksQuery)

  const activeBanks = (bankAccounts || []).filter((b: any) => b.status === "ACTIVE")

  // Filtered Data
  const filteredVales = useMemo(() => {
    if (!valesRaw) return []
    return valesRaw.filter((v: any) => 
      v.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.type?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a: any, b: any) => b.date.localeCompare(a.date))
  }, [valesRaw, searchTerm])

  const payrollReport = useMemo(() => {
    if (!valesRaw) return []
    const report: any = {}

    valesRaw.forEach((v: any) => {
      if (v.status === "ACTIVE" && v.remainingBalance > 0) {
        if (!report[v.employeeName]) {
          report[v.employeeName] = { totalToDiscount: 0, details: [] }
        }
        // Se a parcela é X e falta Y, descontamos o valor da parcela ou o saldo remanescente (o que for menor)
        const toDiscount = Math.min(v.discountPerInstallment, v.remainingBalance)
        report[v.employeeName].totalToDiscount += toDiscount
        report[v.employeeName].details.push({ type: v.type, amount: toDiscount })
      }
    })

    return Object.keys(report).map(key => ({
      employeeName: key,
      ...report[key]
    })).sort((a, b) => b.totalToDiscount - a.totalToDiscount)
  }, [valesRaw])

  const metrics = useMemo(() => {
    let totalEmAberto = 0
    let totalEmitido = 0
    
    valesRaw?.forEach((v: any) => {
      totalEmitido += Number(v.amount)
      if (v.status === "ACTIVE") {
        totalEmAberto += Number(v.remainingBalance)
      }
    })
    
    return { totalEmAberto, totalEmitido }
  }, [valesRaw])

  const handleSave = async () => {
    if (!form.employeeName.trim() || !form.amount || !form.bankAccountId) {
      return toast({ variant: "destructive", title: "Preencha funcionário, valor e conta bancária" })
    }

    setIsSaving(true)
    try {
      const bankAcc = bankAccounts?.find((b: any) => b.id === form.bankAccountId)
      const amount = Number(form.amount)
      const installments = Number(form.installments) || 1
      const discountPerInstallment = Number((amount / installments).toFixed(2))

      const batch = writeBatch(db!)

      // 1. Criar o Vale
      const valeRef = doc(collection(db!, "employee_advances"))
      batch.set(valeRef, {
        employeeName: form.employeeName,
        type: form.type,
        amount,
        installments,
        discountPerInstallment,
        discountedAmount: 0,
        remainingBalance: amount,
        bankAccountId: form.bankAccountId,
        date: form.date,
        notes: form.notes,
        status: "ACTIVE",
        createdAt: serverTimestamp(),
      })

      // 2. Descontar da Conta Bancária (Integração)
      const bankRef = doc(db!, "bank_accounts", form.bankAccountId)
      batch.update(bankRef, {
        currentBalance: (bankAcc?.currentBalance || 0) - amount,
        updatedAt: serverTimestamp()
      })

      // 3. Registrar Log Financeiro da Saída
      const transRef = doc(collection(db!, "financial_transactions"))
      batch.set(transRef, {
        type: "EXPENSE",
        date: form.date,
        amount: amount,
        description: `Vale/Adiantamento: ${form.employeeName} (${form.type})`,
        status: "COMPLETED",
        bankAccountId: form.bankAccountId,
        sourceName: bankAcc?.name,
        createdAt: serverTimestamp(),
      })

      await batch.commit()
      
      toast({ title: "Vale emitido com sucesso!" })
      setIsDialogOpen(false)
      setForm(emptyForm)
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Erro ao emitir vale" })
    } finally {
      setIsSaving(false)
    }
  }

  const openDiscountDialog = (vale: any) => {
    setSelectedVale(vale)
    setDiscountAmount(Math.min(vale.discountPerInstallment, vale.remainingBalance))
    setIsDiscountDialogOpen(true)
  }

  const handleRegisterDiscount = async () => {
    if (!selectedVale || !discountAmount) return

    const amountToDiscount = Number(discountAmount)
    if (amountToDiscount <= 0 || amountToDiscount > selectedVale.remainingBalance) {
      return toast({ variant: "destructive", title: "Valor de desconto inválido" })
    }

    setIsSaving(true)
    try {
      const newDiscounted = selectedVale.discountedAmount + amountToDiscount
      const newBalance = selectedVale.amount - newDiscounted
      const newStatus = newBalance <= 0 ? "FULLY_DISCOUNTED" : "ACTIVE"

      await updateDoc(doc(db!, "employee_advances", selectedVale.id), {
        discountedAmount: newDiscounted,
        remainingBalance: newBalance,
        status: newStatus,
        updatedAt: serverTimestamp()
      })

      toast({ title: "Desconto registrado!" })
      setIsDiscountDialogOpen(false)
      setSelectedVale(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao aplicar desconto" })
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Vales e Adiantamentos</h1>
          <p className="text-muted-foreground">Emissão e controle de descontos em folha de pagamento.</p>
        </div>
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => { setForm(emptyForm); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Emitir Novo Vale
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-indigo-600">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Wallet className="h-3 w-3" /> Saldo a Descontar</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-indigo-600">{formatCurrency(metrics.totalEmAberto)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pendente em aberto</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-muted">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ArrowDownCircle className="h-3 w-3" /> Total Emitido Histórico</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-foreground">{formatCurrency(metrics.totalEmitido)}</div>
            <p className="text-xs text-muted-foreground mt-1">Soma de todos os vales</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="list" className="flex items-center gap-2"><Receipt className="h-4 w-4"/> Lista de Vales</TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2"><Users className="h-4 w-4"/> Fechamento de Folha</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader className="p-4 flex flex-row items-center justify-between border-b space-y-0">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar funcionário ou tipo..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingVales ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredVales.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">Nenhum vale emitido encontrado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Descontado</TableHead>
                      <TableHead className="text-right">Saldo em Aberto</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVales.map((item: any) => (
                      <TableRow key={item.id} className={item.status === 'FULLY_DISCOUNTED' ? 'opacity-60 bg-muted/30' : ''}>
                        <TableCell className="font-medium">{format(parseISO(item.date), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-bold">{item.employeeName}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(item.discountedAmount)}</TableCell>
                        <TableCell className="text-right font-bold text-indigo-600">{formatCurrency(item.remainingBalance)}</TableCell>
                        <TableCell className="text-center">
                          {item.status === 'ACTIVE' 
                            ? <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Ativo</Badge> 
                            : <Badge className="bg-emerald-500">Quitado</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === 'ACTIVE' && (
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => openDiscountDialog(item)}>
                              Abater Desconto
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Descontos da Folha</CardTitle>
                <CardDescription>Resumo sugerido de deduções do mês atual por funcionário baseado nas parcelas dos vales em aberto.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/> Imprimir</Button>
            </CardHeader>
            <CardContent>
              {payrollReport.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                  Não há vales ativos aguardando desconto.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {payrollReport.map((rep: any) => (
                    <div key={rep.employeeName} className="border rounded-xl p-4 bg-muted/10">
                      <div className="flex items-center gap-3 mb-3 border-b pb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                          {rep.employeeName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold">{rep.employeeName}</h3>
                          <p className="text-xs text-muted-foreground">Descontos Pendentes</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {rep.details.map((det: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{det.type}</span>
                            <span className="font-medium text-destructive">-{formatCurrency(det.amount)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-destructive/10 p-2 rounded-md flex justify-between items-center font-bold text-destructive">
                        <span>Total a Descontar:</span>
                        <span>{formatCurrency(rep.totalToDiscount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir Vale / Adiantamento</DialogTitle>
            <DialogDescription>O valor será debitado do caixa da empresa e registrado para desconto futuro.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Funcionário *</Label>
              <Input placeholder="Ex: João Silva" value={form.employeeName} onChange={(e) => setForm({...form, employeeName: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Tipo de Vale</Label>
              <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADIANTAMENTO">Adiantamento Salarial</SelectItem>
                  <SelectItem value="VALE_TRANSPORTE">Vale Transporte</SelectItem>
                  <SelectItem value="VALE_REFEICAO">Vale Refeição / Alimentação</SelectItem>
                  <SelectItem value="EMPRESTIMO">Empréstimo</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor do Vale (R$) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value as any})} />
              </div>
              <div className="space-y-2">
                <Label>Nº de Parcelas</Label>
                <Input type="number" min="1" value={form.installments} onChange={(e) => setForm({...form, installments: parseInt(e.target.value) || 1})} />
              </div>
            </div>

            {form.amount > 0 && form.installments > 0 && (
              <div className="bg-indigo-50 text-indigo-800 p-2 text-xs rounded-md border border-indigo-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4"/> 
                Será descontado na folha o valor de <strong>{formatCurrency(form.amount / form.installments)}</strong> por parcela.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Emissão</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Conta de Saída *</Label>
                <Select value={form.bankAccountId} onValueChange={(v) => setForm({...form, bankAccountId: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeBanks.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input placeholder="Motivo ou detalhe..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Emitir Vale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Desconto */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aplicar Desconto</DialogTitle>
            <DialogDescription>Abater o valor do vale em aberto após o fechamento da folha.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted p-3 flex justify-between items-center rounded-lg">
              <span className="text-sm">Saldo Devedor Atual:</span>
              <span className="font-bold text-indigo-600">{formatCurrency(selectedVale?.remainingBalance)}</span>
            </div>
            <div className="space-y-2">
              <Label>Valor a descontar agora (R$)</Label>
              <Input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDiscountDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterDiscount} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Registrar Desconto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
