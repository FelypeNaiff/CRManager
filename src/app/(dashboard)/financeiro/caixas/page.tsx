"use client"

import { useState, useMemo, useEffect } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/supabase-mocks"
import { useProfile } from "@/lib/contexts/profile-context"
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, limit, getDoc, setDoc } from "@/supabase-mocks/firestore"
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
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, 
  Wallet, AlertTriangle, FileText, CheckCircle2, Calculator 
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function CaixasPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()

  // Queries
  const caixasQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "cash_registers"), orderBy("createdAt", "desc"))
  }, [db])

  // Data fetching
  const { data: caixasHistory, isLoading } = useCollection(caixasQuery)

  const [requireOpenRegister, setRequireOpenRegister] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)

  // Modals state
  const [isOpening, setIsOpening] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Forms
  const [initialBalance, setInitialBalance] = useState<number | string>(0)
  const [countedBalance, setCountedBalance] = useState<number | string>("")
  const [closingNotes, setClosingNotes] = useState("")

  // Check if there is an active open register
  const openRegister = useMemo(() => {
    if (!caixasHistory) return null
    return caixasHistory.find((c: any) => c.status === "OPEN")
  }, [caixasHistory])

  // Load PDV config
  useEffect(() => {
    async function loadConfig() {
      if (!db) return
      try {
        const confDoc = await getDoc(doc(db, "configuracoes", "pdv"))
        if (confDoc.exists()) {
          setRequireOpenRegister(confDoc.data().requireOpenRegister || false)
        }
      } catch (err) {
        console.error("Erro ao carregar config:", err)
      } finally {
        setConfigLoading(false)
      }
    }
    loadConfig()
  }, [db])

  const handleToggleConfig = async (val: boolean) => {
    if (!db) return
    setRequireOpenRegister(val)
    try {
      await setDoc(doc(db, "configuracoes", "pdv"), { requireOpenRegister: val }, { merge: true })
      toast({ title: "Configuração atualizada!" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar configuração" })
      setRequireOpenRegister(!val)
    }
  }

  const handleOpenRegister = async () => {
    if (initialBalance === "" || isNaN(Number(initialBalance))) {
      return toast({ variant: "destructive", title: "Informe um saldo inicial válido" })
    }

    setIsSaving(true)
    try {
      await addDoc(collection(db, "cash_registers"), {
        userId: activeProfile?.id || "unknown",
        userName: activeProfile?.nome || "Usuário Desconhecido",
        openedAt: serverTimestamp(),
        initialBalance: Number(initialBalance),
        currentBalance: Number(initialBalance), // Current balance updates when transactions happen
        status: "OPEN",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Caixa aberto com sucesso!" })
      setIsOpening(false)
      setInitialBalance(0)
    } catch {
      toast({ variant: "destructive", title: "Erro ao abrir o caixa" })
    } finally {
      setIsSaving(false)
    }
  }

  const calculatedBalance = openRegister ? openRegister.currentBalance : 0
  const difference = Number(countedBalance) - calculatedBalance
  const needsJustification = countedBalance !== "" && Math.abs(difference) > 0.01

  const handleCloseRegister = async () => {
    if (countedBalance === "" || isNaN(Number(countedBalance))) {
      return toast({ variant: "destructive", title: "Informe o saldo apurado em gaveta" })
    }

    if (needsJustification && !closingNotes.trim()) {
      return toast({ variant: "destructive", title: "Justificativa obrigatória", description: "O saldo da gaveta não bate com o sistema. Justifique." })
    }

    setIsSaving(true)
    try {
      await updateDoc(doc(db, "cash_registers", openRegister.id), {
        status: "CLOSED",
        closedAt: serverTimestamp(),
        finalBalance: Number(countedBalance),
        difference: difference,
        notes: closingNotes.trim(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Caixa fechado com sucesso!" })
      setIsClosing(false)
      setCountedBalance("")
      setClosingNotes("")
    } catch {
      toast({ variant: "destructive", title: "Erro ao fechar o caixa" })
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  const formatFirestoreTime = (timestamp: any) => {
    if (!timestamp) return "-"
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return format(date, "dd/MM/yyyy HH:mm")
    } catch {
      return "-"
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Controle de Caixa</h1>
          <p className="text-muted-foreground">Gerencie aberturas, fechamentos e conferências de gaveta.</p>
        </div>
        
        {!configLoading && (
          <div className="flex items-center gap-3 bg-muted/50 p-2 px-4 rounded-xl border">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Bloquear PDV</Label>
              <p className="text-xs text-muted-foreground">Exigir caixa aberto</p>
            </div>
            <Switch checked={requireOpenRegister} onCheckedChange={handleToggleConfig} />
          </div>
        )}
      </div>

      {/* STATUS DO CAIXA ATUAL */}
      {openRegister ? (
        <Card className="border-2 border-emerald-500 shadow-md bg-emerald-50/10">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl text-emerald-600 flex items-center gap-2">
                  <Unlock className="h-6 w-6" /> Caixa Aberto
                </CardTitle>
                <CardDescription className="mt-1">
                  Aberto por <strong className="text-foreground">{openRegister.userName}</strong> em {formatFirestoreTime(openRegister.openedAt)}
                </CardDescription>
              </div>
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => setIsClosing(true)}>
                <Lock className="mr-2 h-4 w-4" /> Fechar Caixa
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-background p-4 rounded-xl border">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Wallet className="w-4 h-4"/> Saldo Inicial</div>
                <div className="text-xl font-bold">{formatCurrency(openRegister.initialBalance)}</div>
              </div>
              <div className="bg-background p-4 rounded-xl border border-blue-200">
                <div className="text-sm text-blue-600 mb-1 flex items-center gap-1"><ArrowUpCircle className="w-4 h-4"/> Entradas (Vendas/Rec)</div>
                <div className="text-xl font-bold text-blue-600">
                  {/* Isso seria calculado pelo banco no hook real. Para simulação, diferença entre atual e inicial */}
                  {formatCurrency(Math.max(0, openRegister.currentBalance - openRegister.initialBalance))}
                </div>
              </div>
              <div className="bg-background p-4 rounded-xl border border-orange-200">
                <div className="text-sm text-orange-600 mb-1 flex items-center gap-1"><ArrowDownCircle className="w-4 h-4"/> Saídas (Sangrias)</div>
                <div className="text-xl font-bold text-orange-600">
                  {formatCurrency(Math.max(0, openRegister.initialBalance - openRegister.currentBalance))}
                </div>
              </div>
              <div className="bg-emerald-600 p-4 rounded-xl border-none text-white shadow-inner">
                <div className="text-emerald-100 text-sm mb-1 flex items-center gap-1"><Calculator className="w-4 h-4"/> Saldo Calculado</div>
                <div className="text-2xl font-bold">{formatCurrency(openRegister.currentBalance)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">O Caixa está Fechado</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Nenhuma movimentação financeira pode ser realizada ou vendas processadas (se o bloqueio estiver ativo) até que o caixa seja aberto.
            </p>
            <Button size="lg" onClick={() => setIsOpening(true)}>
              <Unlock className="mr-2 h-4 w-4" /> Abrir Caixa Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO DE CAIXAS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/> Histórico de Caixas (Logs)</CardTitle>
          <CardDescription>Registro completo de aberturas, fechamentos e diferenças apuradas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Final / Calculado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(caixasHistory || []).map((c: any) => {
                const diff = c.difference || 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.userName}</TableCell>
                    <TableCell>{formatFirestoreTime(c.openedAt)}</TableCell>
                    <TableCell>{formatFirestoreTime(c.closedAt)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.initialBalance)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.status === "CLOSED" ? formatCurrency(c.finalBalance) : formatCurrency(c.currentBalance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "CLOSED" ? (
                        <span className={`font-semibold ${diff < 0 ? 'text-destructive' : diff > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.status === "OPEN" ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600">Aberto</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Fechado</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {caixasHistory?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhum registro de caixa encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: ABRIR CAIXA */}
      <Dialog open={isOpening} onOpenChange={setIsOpening}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abertura de Caixa</DialogTitle>
            <DialogDescription>
              Inicie o caixa para o turno atual informando o troco em gaveta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-3 rounded-lg text-sm text-center">
              Operador: <strong>{activeProfile?.nome}</strong>
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial / Troco (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                autoFocus
                value={initialBalance} 
                onChange={(e) => setInitialBalance(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpening(false)}>Cancelar</Button>
            <Button onClick={handleOpenRegister} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmar Abertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: FECHAR CAIXA */}
      <Dialog open={isClosing} onOpenChange={setIsClosing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fechamento de Caixa</DialogTitle>
            <DialogDescription>
              Realize a contagem física do dinheiro em gaveta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex justify-between items-center">
              <span className="text-emerald-800 font-medium">Saldo Calculado (Sistema):</span>
              <span className="text-2xl font-bold text-emerald-600">{formatCurrency(calculatedBalance)}</span>
            </div>
            
            <div className="space-y-2 pt-2">
              <Label>Saldo Físico Contado na Gaveta (R$) *</Label>
              <Input 
                type="number" 
                step="0.01" 
                autoFocus
                className="text-lg font-semibold"
                placeholder="0,00"
                value={countedBalance} 
                onChange={(e) => setCountedBalance(e.target.value)} 
              />
            </div>

            {countedBalance !== "" && !isNaN(Number(countedBalance)) && (
              <div className={`p-3 rounded-lg flex items-center justify-between border ${
                difference === 0 ? 'bg-muted/50 border-muted' : 
                difference > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>
                <span className="text-sm font-medium flex items-center gap-1">
                  {difference === 0 ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                  Diferença Apurada:
                </span>
                <span className="font-bold text-lg">
                  {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                </span>
              </div>
            )}

            {needsJustification && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-destructive font-semibold">Justificativa da Quebra de Caixa *</Label>
                <Textarea 
                  placeholder="Explique o motivo da diferença (ex: Troco errado, sangria não registrada...)" 
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="border-destructive/50 focus-visible:ring-destructive/50"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClosing(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCloseRegister} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
