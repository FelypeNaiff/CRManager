"use client"

import React, { useMemo, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Wallet, Search, Loader2, Plus, ArrowUpRight, ArrowDownLeft, AlertCircle, Pencil, History } from "lucide-react"
import { getWallets, adjustWalletBalance, getWalletHistory } from "@/lib/crm/actions"
import { toast } from "@/hooks/use-toast"

export default function CarteiraSaldosPage() {
  const searchParams = useSearchParams()
  const filterParam = searchParams?.get("filter")

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedWallet, setSelectedWallet] = useState<any>(null)
  
  // Wallet Adjust Dialog State
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustType, setAdjustType] = useState<"ENTRADA" | "SAIDA">("ENTRADA")
  const [adjustReason, setAdjustReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Wallet movements details state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedMovements, setSelectedMovements] = useState<any[]>([])

  // Supabase states
  const [wallets, setWallets] = useState<any[] | null>(null)
  const [isLoadingWallets, setIsLoadingWallets] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoadingWallets(true)
    setError(null)
    try {
      const res = await getWallets()
      if (res.success && res.data) {
        // Map to compatible frontend structure
        const mapped = res.data.map((w: any) => ({
          id: w.id,
          cliente_id: w.customerId,
          saldo_atual: Number(w.balance),
          total_creditos_gerados: w.movements
            .filter((m: any) => m.type === 'credit')
            .reduce((sum: number, m: any) => sum + Number(m.amount), 0),
          total_creditos_utilizados: w.movements
            .filter((m: any) => m.type === 'debit')
            .reduce((sum: number, m: any) => sum + Number(m.amount), 0),
          clientName: w.customer?.name || "Cliente Desconhecido",
          clientPhone: w.customer?.phone || "",
          clientCpf: w.customer?.cpf || ""
        }))
        setWallets(mapped)
      } else {
        setError(res.error || "Erro ao carregar carteiras.")
      }
    } catch (e: any) {
      console.error(e)
      setError("Falha ao carregar carteiras do CRM.")
    } finally {
      setIsLoadingWallets(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredWallets = useMemo(() => {
    if (!wallets) return []
    return wallets.filter(w => {
      const matchSearch = 
        w.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.clientPhone.includes(searchTerm) ||
        w.clientCpf.replace(/\D/g, "").includes(searchTerm.replace(/\D/g, ""))
      
      const matchFilter = filterParam === "com-saldo" ? (w.saldo_atual || 0) > 0 : true
      
      return matchSearch && matchFilter
    })
  }, [wallets, searchTerm, filterParam])

  const openAdjustDialog = (wallet: any) => {
    setSelectedWallet(wallet)
    setAdjustAmount("")
    setAdjustReason("")
    setAdjustType("ENTRADA")
    setIsAdjustOpen(true)
  }

  const openHistoryDialog = async (wallet: any) => {
    setSelectedWallet(wallet)
    setIsHistoryOpen(true)
    setSelectedMovements([])
    
    // Load movements from Supabase
    try {
      const res = await getWalletHistory(wallet.id)
      if (res.success && res.data) {
        const mappedMoves = res.data.map((m: any) => ({
          id: m.id,
          tipo_movimentacao: m.type === 'credit' ? 'ENTRADA' : 'SAIDA',
          origem: m.reason?.includes('AJUSTE') ? 'AJUSTE_MANUAL' : 'SISTEMA',
          valor: Number(m.amount),
          observacao: m.reason || "Sem descrição",
          usuario_responsavel: "Operador",
          created_at: { seconds: new Date(m.createdAt).getTime() / 1000 }
        }))
        setSelectedMovements(mappedMoves)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveAdjustment = async () => {
    if (!adjustAmount || Number(adjustAmount) <= 0) {
      return toast({ variant: "destructive", title: "Valor inválido" })
    }
    if (!adjustReason.trim()) {
      return toast({ variant: "destructive", title: "Motivo obrigatório" })
    }
    if (!selectedWallet) return

    setIsSaving(true)
    try {
      const res = await adjustWalletBalance({
        customerId: selectedWallet.cliente_id,
        amount: Number(adjustAmount),
        type: adjustType === "ENTRADA" ? "credit" : "debit",
        reason: adjustReason
      })

      if (res.success) {
        toast({ title: "Crédito ajustado!", description: "A carteira foi atualizada com sucesso." })
        await loadData()
        setIsAdjustOpen(false)
      } else {
        toast({ variant: "destructive", title: "Erro ao ajustar saldo", description: res.error })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setIsSaving(false)
    }
  }

  const computedHistoryBalance = useMemo(() => {
    if (!selectedMovements || selectedMovements.length === 0) return 0
    return selectedMovements.reduce((acc, move) => {
      const val = move.valor || 0
      const isPositive = move.tipo_movimentacao === "ENTRADA"
      return isPositive ? acc + val : acc - val
    }, 0)
  }, [selectedMovements])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Wallet className="h-8 w-8 text-indigo-600" /> Carteiras de Saldos & Créditos
        </h1>
        <p className="text-muted-foreground text-sm">Monitore créditos acumulados de trocas, bônus gerados em vendas, e realize ajustes manuais com auditoria.</p>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do cliente ou CPF..."
            className="pl-10 h-10 bg-slate-50/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Grid view of Wallets */}
      {isLoadingWallets ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-muted-foreground text-xs">Carregando carteiras de saldos...</p>
        </div>
      ) : filteredWallets.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-slate-50/40 text-muted-foreground text-xs">
          Nenhuma carteira ativa localizada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWallets.map((wallet) => (
            <Card key={wallet.id} className="border border-slate-100 shadow-sm bg-white hover:border-indigo-500/30 hover:shadow-md transition-all">
              <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 truncate max-w-[180px]">{wallet.clientName}</h3>
                  <span className="text-[10px] text-muted-foreground">Cel: {wallet.clientPhone || "Sem cel"}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <Wallet className="h-4 w-4" />
                </div>
              </CardHeader>
              
              <CardContent className="p-4 pt-2 space-y-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Saldo Atual</span>
                  <strong className="text-lg text-indigo-600">R$ {wallet.saldo_atual?.toFixed(2) || "0.00"}</strong>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 border rounded-lg bg-emerald-50/10">
                    <span className="text-slate-400 block">Gerado Total</span>
                    <strong className="text-emerald-600 block text-xs mt-0.5">R$ {wallet.total_creditos_gerados?.toFixed(2) || "0.00"}</strong>
                  </div>
                  <div className="p-2 border rounded-lg bg-rose-50/10">
                    <span className="text-slate-400 block">Utilizado Total</span>
                    <strong className="text-rose-600 block text-xs mt-0.5">R$ {wallet.total_creditos_utilizados?.toFixed(2) || "0.00"}</strong>
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-3">
                  <Button variant="outline" className="flex-1 text-[11px] h-8 gap-1 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50" onClick={() => openAdjustDialog(wallet)}>
                    <Pencil className="h-3 w-3" /> Ajustar Saldo
                  </Button>
                  <Button variant="ghost" className="flex-1 text-[11px] h-8 gap-1 text-slate-600 hover:bg-slate-50" onClick={() => openHistoryDialog(wallet)}>
                    <History className="h-3 w-3" /> Extrato
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ADJUST WALLET DIALOG */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">Ajuste de Saldo - {selectedWallet?.clientName}</DialogTitle>
            <DialogDescription>
              Lance acréscimos ou descontos manuais na carteira de créditos do cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1">
              <Label>Ação</Label>
              <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecionar ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Adicionar Crédito (Entrada)</SelectItem>
                  <SelectItem value="SAIDA">Debitar Crédito (Saída)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fvalor">Valor do Ajuste (R$) *</Label>
              <Input id="fvalor" type="number" step="0.01" placeholder="0.00" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fmotivo">Motivo / Justificativa Obrigatória *</Label>
              <Input id="fmotivo" placeholder="Ex: Devolução autorizada pelo gerente." value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSaveAdjustment} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXTENDED HISTORY DIALOG */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader className="border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <DialogTitle className="text-lg font-bold text-slate-800">Extrato Consolidado - {selectedWallet?.clientName}</DialogTitle>
                <DialogDescription>
                  Confira a trilha completa de movimentações desta carteira.
                </DialogDescription>
              </div>
              <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 py-1 text-xs shrink-0 self-start sm:self-center">
                ✓ R$ {computedHistoryBalance.toFixed(2)} calculado pelo extrato
              </Badge>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {selectedMovements.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10">Sem movimentações financeiras para esta conta.</p>
            ) : (
              <div className="border rounded-xl divide-y text-xs max-h-[400px] overflow-y-auto">
                {selectedMovements.map((move, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase ${move.tipo_movimentacao === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {move.tipo_movimentacao}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-normal h-4">{move.origem}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Responsável: {move.usuario_responsavel} · Obs: {move.observacao}</p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <strong className={`text-sm ${move.tipo_movimentacao === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {move.tipo_movimentacao === 'ENTRADA' ? '+' : '-'} R$ {move.valor?.toFixed(2)}
                      </strong>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {move.created_at ? new Date(move.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Fechar Extrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
