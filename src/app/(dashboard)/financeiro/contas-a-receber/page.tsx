"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { useProfile } from "@/lib/contexts/profile-context"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, writeBatch, increment } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Search, Plus, MoreVertical, Pencil, Trash2, Loader2, 
  Wallet, AlertCircle, CheckCircle2, Clock, CalendarDays, Undo2, ChevronLeft, ChevronRight
} from "lucide-react"
import { format, startOfMonth, endOfMonth, parseISO, isBefore, isAfter, isToday, addMonths, subMonths, addDays, addYears } from "date-fns"
import { ptBR } from "date-fns/locale"

const emptyForm = {
  description: "",
  amount: 0,
  dueDate: "",
  clientId: "",
  clientName: "",
  chartOfAccountId: "",
  costCenterId: "",
  bankAccountId: "",
  notes: "",
  documentNumber: "",
  isRecurring: false,
  recurrenceFrequency: "MONTHLY",
  recurrenceInstallments: 2,
}

export default function ContasAReceberPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  
  const [editingItem, setEditingItem] = useState<any>(null)
  const [actionItem, setActionItem] = useState<any>(null)
  
  const [form, setForm] = useState(emptyForm)
  const [paymentForm, setPaymentForm] = useState({ receiptDate: format(new Date(), "yyyy-MM-dd"), bankAccountId: "", receivedAmount: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [isReverseOpen, setIsReverseOpen] = useState(false)
  const [actionReason, setActionReason] = useState("")

  const db = useFirestore()
  const { activeProfile } = useProfile()

  // Queries
  const receivablesQuery = useMemoFirebase(() => collection(db, "accounts_receivable"), [db])
  const clientsQuery = useMemoFirebase(() => collection(db, "clientes"), [db])
  const chartQuery = useMemoFirebase(() => collection(db, "chart_of_accounts"), [db])
  const costCentersQuery = useMemoFirebase(() => collection(db, "cost_centers"), [db])
  const banksQuery = useMemoFirebase(() => collection(db, "bank_accounts"), [db])

  // Data fetching
  const { data: rawReceivables, isLoading: loadingReceivables } = useCollection(receivablesQuery)
  const { data: clients } = useCollection(clientsQuery)
  const { data: chartOfAccounts } = useCollection(chartQuery)
  const { data: costCenters } = useCollection(costCentersQuery)
  const { data: bankAccounts } = useCollection(banksQuery)

  // Permissões
  const canReverse = activeProfile?.role === "ADMIN" || activeProfile?.role === "GERENTE" || activeProfile?.role === "MASTER"

  // Filter lists
  const revenueAccounts = (chartOfAccounts || []).filter((c: any) => c.type === 'REVENUE' && c.status === 'ACTIVE').sort((a: any, b: any) => a.code.localeCompare(b.code))
  const activeCostCenters = (costCenters || []).filter((c: any) => c.status === 'ACTIVE')
  const activeBanks = (bankAccounts || []).filter((b: any) => b.status === 'ACTIVE')

  // Data processing (Filters)
  const filteredData = useMemo(() => {
    if (!rawReceivables) return []
    
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    const startStr = format(start, "yyyy-MM-dd")
    const endStr = format(end, "yyyy-MM-dd")

    return rawReceivables.filter((item: any) => {
      // Filtrar pelo mês atual (pela data de vencimento ou recebimento)
      const dateToCompare = item.receiptDate || item.dueDate
      if (!dateToCompare || dateToCompare < startStr || dateToCompare > endStr) {
        return false
      }

      // Busca avançada
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (
          item.description?.toLowerCase().includes(term) ||
          item.clientName?.toLowerCase().includes(term) ||
          item.documentNumber?.toLowerCase().includes(term)
        )
      }
      return true
    }).sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate))
  }, [rawReceivables, currentDate, searchTerm])

  // Metrics calculation
  const metrics = useMemo(() => {
    let vencidos = 0, vencemHoje = 0, aVencer = 0, recebidos = 0, total = 0;
    const todayStr = format(new Date(), "yyyy-MM-dd")

    filteredData.forEach((item: any) => {
      const amount = Number(item.amount) || 0
      total += amount

      if (item.status === "PAID") {
        recebidos += amount
      } else {
        if (item.dueDate < todayStr) vencidos += amount
        else if (item.dueDate === todayStr) vencemHoje += amount
        else aVencer += amount
      }
    })

    return { vencidos, vencemHoje, aVencer, recebidos, total }
  }, [filteredData])

  // Handlers
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const handleCurrentMonth = () => setCurrentDate(new Date())

  const openNewDialog = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: any) => {
    setEditingItem(item)
    setForm({
      description: item.description || "",
      amount: item.amount || 0,
      dueDate: item.dueDate || "",
      clientId: item.clientId || "",
      clientName: item.clientName || "",
      chartOfAccountId: item.chartOfAccountId || "",
      costCenterId: item.costCenterId || "",
      bankAccountId: item.bankAccountId || "",
      notes: item.notes || "",
      documentNumber: item.documentNumber || "",
      isRecurring: false,
      recurrenceFrequency: "MONTHLY",
      recurrenceInstallments: 2,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount || !form.dueDate) {
      return toast({ variant: "destructive", title: "Preencha os campos obrigatórios (Descrição, Valor e Vencimento)" })
    }

    setIsSaving(true)
    try {
      const client = clients?.find((c: any) => c.id === form.clientId)
      
      const dataToSave = {
        description: form.description,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        clientId: form.clientId || null,
        clientName: client?.nome || form.clientName || null,
        chartOfAccountId: form.chartOfAccountId || null,
        costCenterId: form.costCenterId || null,
        bankAccountId: form.bankAccountId || null,
        notes: form.notes,
        documentNumber: form.documentNumber,
        updatedAt: serverTimestamp(),
      }

      if (editingItem) {
        await updateDoc(doc(db, "accounts_receivable", editingItem.id), dataToSave)
        toast({ title: "Conta atualizada com sucesso!" })
      } else {
        if (form.isRecurring && form.recurrenceInstallments > 1) {
          const batch = writeBatch(db!)
          let currentDueDate = parseISO(form.dueDate)
          
          for (let i = 0; i < form.recurrenceInstallments; i++) {
            const newRef = doc(collection(db!, "accounts_receivable"))
            const instDueDate = format(currentDueDate, "yyyy-MM-dd")
            
            batch.set(newRef, {
              ...dataToSave,
              dueDate: instDueDate,
              description: `${form.description} (${i + 1}/${form.recurrenceInstallments})`,
              receivedAmount: 0,
              status: "PENDING",
              createdAt: serverTimestamp(),
            })
            
            // Incrementar a data
            if (form.recurrenceFrequency === "MONTHLY") currentDueDate = addMonths(currentDueDate, 1)
            else if (form.recurrenceFrequency === "WEEKLY") currentDueDate = addDays(currentDueDate, 7)
            else if (form.recurrenceFrequency === "YEARLY") currentDueDate = addYears(currentDueDate, 1)
          }
          await batch.commit()
          toast({ title: `${form.recurrenceInstallments} parcelas geradas com sucesso!` })
        } else {
          await addDoc(collection(db!, "accounts_receivable"), {
            ...dataToSave,
            receivedAmount: 0,
            status: "PENDING",
            createdAt: serverTimestamp(),
          })
          toast({ title: "Conta cadastrada com sucesso!" })
        }
      }

      setIsDialogOpen(false)
      setForm(emptyForm)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!actionItem || !actionReason.trim()) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db!)
      
      // Criar log de auditoria
      const logRef = doc(collection(db!, "audit_logs"))
      batch.set(logRef, {
        collection: "accounts_receivable",
        documentId: actionItem.id,
        action: "DELETE",
        justification: actionReason,
        userId: activeProfile?.id || "unknown",
        userName: activeProfile?.nome || "Sistema",
        timestamp: serverTimestamp(),
        oldData: actionItem,
      })

      batch.delete(doc(db!, "accounts_receivable", actionItem.id))
      
      await batch.commit()
      toast({ title: "Conta excluída e auditada" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setActionItem(null)
      setActionReason("")
      setIsDeleteOpen(false)
      setIsSaving(false)
    }
  }

  const openPaymentDialog = (item: any) => {
    setActionItem(item)
    setPaymentForm({
      receiptDate: format(new Date(), "yyyy-MM-dd"),
      bankAccountId: item.bankAccountId || "",
      receivedAmount: item.amount,
    })
    setIsPaymentOpen(true)
  }

  const handleConfirmPayment = async () => {
    if (!actionItem || !paymentForm.receiptDate || !paymentForm.bankAccountId) {
      return toast({ variant: "destructive", title: "Data e Conta Bancária são obrigatórios" })
    }

    setIsSaving(true)
    try {
      const batch = writeBatch(db!)
      const arRef = doc(db!, "accounts_receivable", actionItem.id)

      batch.update(arRef, {
        status: "PAID",
        receiptDate: paymentForm.receiptDate,
        receivedAmount: Number(paymentForm.receivedAmount),
        bankAccountId: paymentForm.bankAccountId,
        updatedAt: serverTimestamp()
      })

      // Atualizar saldo bancário (Somar)
      const bankRef = doc(db!, "bank_accounts", paymentForm.bankAccountId)
      batch.update(bankRef, {
        currentBalance: increment(Number(paymentForm.receivedAmount)),
        updatedAt: serverTimestamp()
      })

      // Criar transação financeira
      const transRef = doc(collection(db!, "financial_transactions"))
      batch.set(transRef, {
        type: "INCOME",
        amount: Number(paymentForm.receivedAmount),
        date: paymentForm.receiptDate,
        description: `Recebimento: ${actionItem.description}`,
        status: "COMPLETED",
        bankAccountId: paymentForm.bankAccountId,
        referenceId: actionItem.id,
        referenceType: "accounts_receivable",
        createdAt: serverTimestamp(),
      })

      // Auditoria de Baixa
      const logRef = doc(collection(db!, "audit_logs"))
      batch.set(logRef, {
        collection: "accounts_receivable",
        documentId: actionItem.id,
        action: "CONFIRM_RECEIPT",
        userId: activeProfile?.id || "unknown",
        userName: activeProfile?.nome || "Sistema",
        timestamp: serverTimestamp(),
      })

      await batch.commit()
      toast({ title: "Recebimento confirmado!" })
      setIsPaymentOpen(false)
      setActionItem(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao confirmar recebimento" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReversePayment = (item: any) => {
    setActionItem(item)
    setActionReason("")
    setIsReverseOpen(true)
  }

  const handleConfirmReverse = async () => {
    if (!actionItem || !actionReason.trim()) return
    setIsSaving(true)
    
    try {
      const batch = writeBatch(db!)
      const arRef = doc(db!, "accounts_receivable", actionItem.id)

      batch.update(arRef, {
        status: "PENDING",
        receiptDate: null,
        receivedAmount: 0,
        updatedAt: serverTimestamp()
      })

      // Devolver saldo bancário (Subtrair)
      if (actionItem.bankAccountId && actionItem.receivedAmount > 0) {
        const bankRef = doc(db!, "bank_accounts", actionItem.bankAccountId)
        batch.update(bankRef, {
          currentBalance: increment(-Number(actionItem.receivedAmount)),
          updatedAt: serverTimestamp()
        })

        // Criar transação inversa
        const transRef = doc(collection(db!, "financial_transactions"))
        batch.set(transRef, {
          type: "REVERSAL_INCOME",
          amount: Number(actionItem.receivedAmount),
          date: format(new Date(), "yyyy-MM-dd"),
          description: `Estorno de Recebimento: ${actionItem.description}`,
          status: "COMPLETED",
          bankAccountId: actionItem.bankAccountId,
          referenceId: actionItem.id,
          referenceType: "accounts_receivable",
          createdAt: serverTimestamp(),
        })
      }

      // Auditoria de Estorno
      const logRef = doc(collection(db!, "audit_logs"))
      batch.set(logRef, {
        collection: "accounts_receivable",
        documentId: actionItem.id,
        action: "REVERSE_RECEIPT",
        justification: actionReason,
        userId: activeProfile?.id || "unknown",
        userName: activeProfile?.nome || "Sistema",
        timestamp: serverTimestamp(),
      })

      await batch.commit()
      toast({ title: "Recebimento estornado e auditado" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao estornar recebimento" })
    } finally {
      setIsReverseOpen(false)
      setActionItem(null)
      setActionReason("")
      setIsSaving(false)
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  const getStatusBadge = (item: any) => {
    if (item.status === "PAID") return <Badge className="bg-emerald-500 hover:bg-emerald-600">Recebido</Badge>
    const todayStr = format(new Date(), "yyyy-MM-dd")
    if (item.dueDate < todayStr) return <Badge variant="destructive">Em Atraso</Badge>
    if (item.dueDate === todayStr) return <Badge className="bg-orange-500 hover:bg-orange-600">Vence Hoje</Badge>
    return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">A Vencer</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-muted-foreground">Gerencie seus recebimentos, faturamento e cobranças de clientes.</p>
        </div>
        <Button className="gap-2" onClick={openNewDialog}>
          <Plus className="h-4 w-4" /> Nova Conta a Receber
        </Button>
      </div>

      {/* Navegação de Meses */}
      <div className="flex items-center justify-between bg-card p-2 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold text-lg capitalize min-w-[140px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleCurrentMonth}>Mês Atual</Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Em Atraso</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-destructive">{formatCurrency(metrics.vencidos)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Clock className="h-3 w-3" /> Vencem Hoje</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-orange-500">{formatCurrency(metrics.vencemHoje)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><CalendarDays className="h-3 w-3" /> A Vencer</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.aVencer)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Recebidos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.recebidos)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Wallet className="h-3 w-3" /> Total Esperado</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-primary">{formatCurrency(metrics.total)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader className="p-4 flex flex-row items-center justify-between border-b space-y-0">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, cliente ou documento..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingReceivables ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredData.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              Nenhuma conta a receber encontrada para o período selecionado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item: any) => {
                  const category = chartOfAccounts?.find((c: any) => c.id === item.chartOfAccountId)
                  return (
                    <TableRow key={item.id} className={item.status === 'PAID' ? 'opacity-70 bg-muted/30' : ''}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(parseISO(item.dueDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                        {item.documentNumber && <div className="text-xs text-muted-foreground">Doc: {item.documentNumber}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.clientName || "-"}</TableCell>
                      <TableCell>
                        {category ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{category.code} - {category.name}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${item.status === 'PAID' ? 'text-emerald-600' : ''}`}>
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(item)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.status === "PENDING" ? (
                              <DropdownMenuItem className="text-emerald-600 font-medium" onClick={() => openPaymentDialog(item)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar Recebimento
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                className="text-orange-600 font-medium" 
                                disabled={!canReverse}
                                onClick={() => handleReversePayment(item)}
                              >
                                <Undo2 className="mr-2 h-4 w-4" /> {canReverse ? "Estornar Recebimento" : "Estorno sem Permissão"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className={item.status === "PAID" ? "text-muted-foreground" : "text-destructive"} 
                              disabled={item.status === "PAID"} 
                              onClick={() => { setActionItem(item); setActionReason(""); setIsDeleteOpen(true); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir {item.status === "PAID" && "(Bloqueado)"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle>
            <DialogDescription>Preencha os detalhes do recebimento esperado.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="md:col-span-2 space-y-2">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Ex: Venda a Prazo, Mensalidade, Prestação de Serviço..." />
            </div>
            
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value as any})} />
            </div>
            
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({...form, dueDate: e.target.value})} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Cliente (Opcional)</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({...form, clientId: v === "null" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhum / Cliente Avulso</SelectItem>
                  {(clients || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria (Plano de Contas)</Label>
              <Select value={form.chartOfAccountId} onValueChange={(v) => setForm({...form, chartOfAccountId: v === "null" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhuma</SelectItem>
                  {revenueAccounts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={form.costCenterId} onValueChange={(v) => setForm({...form, costCenterId: v === "null" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Selecione o centro de custo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhum</SelectItem>
                  {activeCostCenters.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta Bancária (Recebimento)</Label>
              <Select value={form.bankAccountId} onValueChange={(v) => setForm({...form, bankAccountId: v === "null" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Onde o dinheiro vai cair" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Indefinida</SelectItem>
                  {activeBanks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nº Documento / Boleto</Label>
              <Input value={form.documentNumber} onChange={(e) => setForm({...form, documentNumber: e.target.value})} placeholder="Opcional" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Anotações internas..." />
            </div>

            {!editingItem && (
              <div className="md:col-span-2 border p-4 rounded-lg bg-muted/20 space-y-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.isRecurring} onCheckedChange={(v) => setForm({...form, isRecurring: v})} />
                  <Label>Tornar esta conta recorrente / parcelada</Label>
                </div>
                
                {form.isRecurring && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label>Frequência</Label>
                      <Select value={form.recurrenceFrequency} onValueChange={(v) => setForm({...form, recurrenceFrequency: v})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WEEKLY">Semanal</SelectItem>
                          <SelectItem value="MONTHLY">Mensal</SelectItem>
                          <SelectItem value="YEARLY">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de Parcelas</Label>
                      <Input type="number" min="2" max="120" value={form.recurrenceInstallments} onChange={(e) => setForm({...form, recurrenceInstallments: parseInt(e.target.value) || 2})} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Recebimento */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5"/> Confirmar Recebimento</DialogTitle>
            <DialogDescription>
              Você está recebendo a conta: <strong className="text-foreground">{actionItem?.description}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded-md flex justify-between items-center mb-2 border border-emerald-100">
              <span className="text-sm font-medium">Valor a Receber:</span>
              <span className="text-lg font-bold">{formatCurrency(actionItem?.amount)}</span>
            </div>
            
            <div className="space-y-2">
              <Label>Data do Recebimento *</Label>
              <Input type="date" value={paymentForm.receiptDate} onChange={(e) => setPaymentForm({...paymentForm, receiptDate: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Conta Bancária de Destino *</Label>
              <Select value={paymentForm.bankAccountId} onValueChange={(v) => setPaymentForm({...paymentForm, bankAccountId: v})}>
                <SelectTrigger><SelectValue placeholder="Onde o dinheiro entrou" /></SelectTrigger>
                <SelectContent>
                  {activeBanks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmPayment} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá a conta permanentemente e será auditada. Por favor, justifique.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Justificativa para Exclusão *</Label>
            <Input placeholder="Motivo da exclusão..." value={actionReason} onChange={(e) => setActionReason(e.target.value)} className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving || !actionReason.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Estorno */}
      <Dialog open={isReverseOpen} onOpenChange={setIsReverseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600"><Undo2 className="h-5 w-5"/> Estornar Recebimento</DialogTitle>
            <DialogDescription>A conta voltará a ficar PENDENTE e exigirá aprovação para um novo recebimento. Esta ação será auditada.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Justificativa do Estorno *</Label>
              <Input placeholder="Ex: Recebimento lançado duplicado, erro de valor..." value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
            </div>
            <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-sm text-orange-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>O operador <strong>{activeProfile?.nome}</strong> ficará registrado como autor deste estorno.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReverseOpen(false)}>Cancelar</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleConfirmReverse} disabled={isSaving || !actionReason.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmar Estorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
