"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PlusCircle, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AuthorizationDialog } from "@/components/authorization/authorization-dialog"
import { createManualAdjustmentAction } from "@/lib/wallet/wallet-actions"
import { safeNumber } from "@/lib/utils/form-normalizer"
import { toast } from "@/hooks/use-toast"

interface CustomerWalletTabProps {
  customer: any
  walletInfo: any
  walletHistory: any[]
  walletFilterStartDate: string
  setWalletFilterStartDate: (s: string) => void
  walletFilterEndDate: string
  setWalletFilterEndDate: (s: string) => void
  walletFilterType: string
  setWalletFilterType: (s: string) => void
  walletFilterOrigin: string
  setWalletFilterOrigin: (s: string) => void
  canUpdate: boolean
  onUpdate: () => void
}

export function CustomerWalletTab({
  customer,
  walletInfo,
  walletHistory,
  walletFilterStartDate,
  setWalletFilterStartDate,
  walletFilterEndDate,
  setWalletFilterEndDate,
  walletFilterType,
  setWalletFilterType,
  walletFilterOrigin,
  setWalletFilterOrigin,
  canUpdate,
  onUpdate
}: CustomerWalletTabProps) {
  const [isAdjustingWallet, setIsAdjustingWallet] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustType, setAdjustType] = useState<"ENTRADA" | "SAIDA">("ENTRADA")
  const [adjustReason, setAdjustReason] = useState("")
  const [isSavingWallet, setIsSavingWallet] = useState(false)
  const [authorizationId, setAuthorizationId] = useState("")
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  const handleSaveWalletAdjustment = async (authId?: string) => {
    const safeAdjust = safeNumber(adjustAmount);
    if (!safeAdjust || safeAdjust <= 0) {
      return toast({ variant: "destructive", title: "Erro", description: "Valor inválido." })
    }
    if (!adjustReason.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Justificativa é obrigatória." })
    }
    if (!walletInfo) return

    setIsSavingWallet(true)
    try {
      const res = await createManualAdjustmentAction({
        customerId: customer.id,
        amount: safeAdjust,
        type: adjustType === "ENTRADA" ? "credit" : "debit",
        reason: adjustReason,
        authorizationId: authId
      })

      if (res.success) {
        toast({ title: "Saldo ajustado!", description: `Carteira atualizada no sistema.` })
        setIsAdjustingWallet(false)
        setAdjustAmount("")
        setAdjustReason("")
        setAuthorizationId("")
        setShowAuthDialog(false)
        onUpdate()
      } else {
        if (res.requireAuthorization) {
          setAuthorizationId(res.authorizationId)
          setShowAuthDialog(true)
        } else {
          toast({ variant: "destructive", title: "Erro ao processar ajuste", description: res.error })
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." })
    } finally {
      setIsSavingWallet(false)
    }
  }

  return (
    <div className="space-y-4 pt-4 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-slate-400 font-semibold block uppercase text-[10px]">Saldo Disponível</span>
            <strong className="text-2xl text-indigo-600 block mt-1">R$ {walletInfo?.saldo_atual?.toFixed(2) || "0.00"}</strong>
          </div>
          {canUpdate && (
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 mt-3 w-full" onClick={() => setIsAdjustingWallet(true)}>
              <PlusCircle className="h-4 w-4" /> Ajuste Manual
            </Button>
          )}
        </div>

        <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl">
          <span className="text-slate-400 font-semibold block uppercase text-[10px]">Total Créditos (Filtro)</span>
          <strong className="text-2xl text-emerald-600 block mt-1">R$ {walletInfo?.total_creditos?.toFixed(2) || "0.00"}</strong>
        </div>

        <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-xl">
          <span className="text-slate-400 font-semibold block uppercase text-[10px]">Total Débitos (Filtro)</span>
          <strong className="text-2xl text-rose-600 block mt-1">R$ {walletInfo?.total_debitos?.toFixed(2) || "0.00"}</strong>
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">Início</label>
          <Input
            type="date"
            className="h-8 text-xs bg-white"
            value={walletFilterStartDate}
            onChange={e => setWalletFilterStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">Fim</label>
          <Input
            type="date"
            className="h-8 text-xs bg-white"
            value={walletFilterEndDate}
            onChange={e => setWalletFilterEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipo</label>
          <select
            className="w-full border rounded h-8 px-2 text-xs bg-white"
            value={walletFilterType}
            onChange={e => setWalletFilterType(e.target.value)}
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="CREDIT">Crédito (Manual)</option>
            <option value="DEBIT">Débito</option>
            <option value="BONUS">Bônus</option>
            <option value="ADJUSTMENT">Ajuste</option>
            <option value="REFUND">Reembolso</option>
            <option value="EXCHANGE">Troca</option>
            <option value="EXPIRATION">Expiração</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">Origem</label>
          <select
            className="w-full border rounded h-8 px-2 text-xs bg-white"
            value={walletFilterOrigin}
            onChange={e => setWalletFilterOrigin(e.target.value)}
          >
            <option value="ALL">Todas as Origens</option>
            <option value="sale">Vendas</option>
            <option value="exchange">Trocas</option>
            <option value="return">Devoluções</option>
            <option value="manual">Ajustes Manuais</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <h4 className="font-bold text-slate-800 text-sm">Histórico do Extrato</h4>
        {walletHistory.length === 0 ? (
          <p className="text-muted-foreground italic text-center py-6">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="border rounded-xl divide-y bg-white max-h-64 overflow-y-auto">
            {walletHistory.map((tx, idx) => {
              const isNegative = tx.type === "DEBIT" || tx.type === "EXPIRATION";
              const colorClass = isNegative ? "text-rose-600" : "text-emerald-600";
              
              return (
                <div key={tx.id || idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[8px] font-bold h-4 ${isNegative ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                        {tx.type}
                      </Badge>
                      {tx.expiresAt && !isNegative && (
                        <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1 rounded border border-amber-100">
                          Validade: {new Date(tx.expiresAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-slate-800 mt-1">{tx.description || "Sem descrição"}</p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Saldos: R$ {tx.balanceBefore?.toFixed(2)} &rarr; R$ {tx.balanceAfter?.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <strong className={`text-sm ${colorClass}`}>
                      {isNegative ? "-" : "+"} R$ {tx.amount?.toFixed(2)}
                    </strong>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {new Date(tx.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isAdjustingWallet} onOpenChange={setIsAdjustingWallet}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Ajuste de Saldo da Carteira</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Ação</Label>
              <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Adicionar Crédito (Entrada)</SelectItem>
                  <SelectItem value="SAIDA">Debitar Crédito (Saída)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Justificativa Obrigatória</Label>
              <Input placeholder="Ex: Ajuste manual" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsAdjustingWallet(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => handleSaveWalletAdjustment()} disabled={isSavingWallet}>
                {isSavingWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Ajuste"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AuthorizationDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        authorizationId={authorizationId}
        authorizationType={adjustType === "ENTRADA" ? "WALLET_CREDIT" : "WALLET_DEBIT"}
        title="Autorização de Ajuste"
        description="Este ajuste manual de saldo exige aprovação de um gerente."
        amount={safeNumber(adjustAmount) ?? 0}
        onAuthorized={(auth) => handleSaveWalletAdjustment(auth.id)}
      />
    </div>
  )
}
