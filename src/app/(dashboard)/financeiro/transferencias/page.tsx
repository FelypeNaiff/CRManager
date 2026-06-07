"use client"

import { useState, useMemo } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/lib/legacy-stubs"
import { collection, doc, writeBatch, serverTimestamp, query, where, orderBy } from "@/lib/legacy-firestore-stubs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Search, Plus, Loader2, ArrowRightLeft, Building2, Banknote, CalendarDays 
} from "lucide-react"
import { safeNumber } from "@/lib/utils/form-normalizer"
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale"

const emptyForm = {
  date: format(new Date(), "yyyy-MM-dd"),
  sourceId: "",
  destinationId: "",
  amount: 0,
  description: "",
}

export default function TransferenciasPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()

  // Queries
  const banksQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "bank_accounts")
  }, [db])

  const transfersQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "financial_transactions"), 
      where("type", "==", "TRANSFER"),
      // mock needs a composite index if orderBy is used with where, 
      // we will sort locally to avoid index creation requirements for the user right now.
    )
  }, [db])

  // Data
  const { data: bankAccounts } = useCollection(banksQuery)
  const { data: rawTransfers, isLoading } = useCollection(transfersQuery)

  const activeBanks = (bankAccounts || []).filter((b: any) => b.status === "ACTIVE")

  // Filter & Sort Transfers
  const filteredTransfers = useMemo(() => {
    if (!rawTransfers) return []
    return rawTransfers
      .filter((t: any) => 
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
  }, [rawTransfers, searchTerm])

  const handleSave = async () => {
    const safeAmount = safeNumber(form.amount)
    if (!form.sourceId || !form.destinationId) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
    if (form.sourceId === form.destinationId) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
    if (!safeAmount || safeAmount <= 0) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }

    const sourceAccount = (bankAccounts ?? []).find((b: any) => b.id === form.sourceId)
    const destAccount = (bankAccounts ?? []).find((b: any) => b.id === form.destinationId)

    if (!sourceAccount || !destAccount) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }

    // Alerta de saldo negativo (mas permite passar, pois contas podem ficar negativas)
    if (sourceAccount.currentBalance < safeAmount) {
      if (!confirm("A conta de origem não possui saldo suficiente para esta transferência. A conta ficará com saldo negativo. Deseja continuar?")) {
        return
      }
    }

    setIsSaving(true)
    try {
      const batch = writeBatch(db!)

      // 1. Debitar Origem
      const sourceRef = doc(db!, "bank_accounts", form.sourceId)
      batch.update(sourceRef, {
        currentBalance: sourceAccount.currentBalance - safeAmount,
        updatedAt: serverTimestamp()
      })

      // 2. Creditar Destino
      const destRef = doc(db!, "bank_accounts", form.destinationId)
      batch.update(destRef, {
        currentBalance: destAccount.currentBalance + safeAmount,
        updatedAt: serverTimestamp()
      })

      // 3. Criar Transação de Transferência (Log)
      const transRef = doc(collection(db!, "financial_transactions"))
      batch.set(transRef, {
        type: "TRANSFER",
        date: form.date,
        amount: safeAmount,
        description: form.description || `Transferência de ${sourceAccount.name} para ${destAccount.name}`,
        status: "COMPLETED",
        bankAccountId: form.sourceId, // Origem
        sourceName: sourceAccount.name,
        destinationBankAccountId: form.destinationId, // Destino
        destinationName: destAccount.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await batch.commit()
      
      toast({ title: "Transferência realizada com sucesso!" })
      setIsDialogOpen(false)
      setForm(emptyForm)
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Transferências</h1>
          <p className="text-muted-foreground">Movimente saldos entre suas contas bancárias e caixas físicos.</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => { setForm(emptyForm); setIsDialogOpen(true); }}>
          <ArrowRightLeft className="h-4 w-4" /> Nãova Transferência
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="col-span-1 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4"/> Dica de Transferência
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Utilize este módulo para registrar envios de dinheiro da conta bancária para o caixa em espécie (Troco), 
            resgates de aplicações ou transferências entre matriz e filial.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 flex flex-row items-center justify-between border-b space-y-0">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              Nenhuma transferência registrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.date ? format(parseISO(item.date), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-medium">
                        {item.sourceName || "Conta Excluída"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 font-medium">
                        {item.destinationName || "Conta Excluída"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center text-xs text-muted-foreground font-medium">
                        <ArrowRightLeft className="h-3 w-3 mr-1" /> Efetivada
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-blue-600"/> Realizar Transferência</DialogTitle>
            <DialogDescription>Transfira saldos entre suas contas cadastradas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Conta de Origem (Sai o dinheiro) *</Label>
              <Select value={form.sourceId} onValueChange={(v) => setForm({...form, sourceId: v})}>
                <SelectTrigger className="border-orange-200 focus:ring-orange-500">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {(activeBanks || []).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex justify-between items-center w-full min-w-[200px]">
                        <span>{b.name}</span>
                        <span className="text-xs text-muted-foreground ml-4">Saldo: {formatCurrency(b.currentBalance)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta de Destino (Entra o dinheiro) *</Label>
              <Select value={form.destinationId} onValueChange={(v) => setForm({...form, destinationId: v})}>
                <SelectTrigger className="border-emerald-200 focus:ring-emerald-500">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent>
                  {activeBanks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id} disabled={b.id === form.sourceId}>
                      <div className="flex justify-between items-center w-full min-w-[200px]">
                        <span>{b.name}</span>
                        <span className="text-xs text-muted-foreground ml-4">Saldo: {formatCurrency(b.currentBalance)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" className="font-semibold text-blue-600" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value as any})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição / Motivo</Label>
              <Textarea 
                placeholder="Ex: Reforço de caixa, Sangria, Aplicação automática..." 
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
