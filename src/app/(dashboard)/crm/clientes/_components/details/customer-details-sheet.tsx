"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Baby, Wallet, History } from "lucide-react"
import { formatPhone } from "../utils"
import { getCustomerHistory, getCustomerExchangeReturns, removeTagFromCustomer, addTagToCustomer } from "@/lib/crm/actions"
import { getCustomerWalletAction } from "@/lib/wallet/wallet-actions"
import { toast } from "@/hooks/use-toast"
import { safeNumber } from "@/lib/utils/form-normalizer"

import { CustomerChildrenTab } from "./tabs/customer-children-tab"
import { CustomerWalletTab } from "./tabs/customer-wallet-tab"
import { CustomerHistoryTab } from "./tabs/customer-history-tab"

interface CustomerDetailsSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  customer: any
  availableTags: any[]
  canUpdate: boolean
  onUpdate: () => void
}

export function CustomerDetailsSheet({
  isOpen,
  onOpenChange,
  customer,
  availableTags,
  canUpdate,
  onUpdate
}: CustomerDetailsSheetProps) {
  const [filhos, setFilhos] = useState<any[]>([])
  const [historyLogs, setHistoryLogs] = useState<any[]>([])
  const [returnsHistory, setReturnsHistory] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const [walletInfo, setWalletInfo] = useState<any>(null)
  const [walletHistory, setWalletHistory] = useState<any[]>([])
  const [walletFilterStartDate, setWalletFilterStartDate] = useState("")
  const [walletFilterEndDate, setWalletFilterEndDate] = useState("")
  const [walletFilterType, setWalletFilterType] = useState("ALL")
  const [walletFilterOrigin, setWalletFilterOrigin] = useState("ALL")

  const loadWalletData = useCallback(async (customerId: string) => {
    if (!customerId) return
    const filters: any = {}
    if (walletFilterStartDate) filters.startDate = new Date(walletFilterStartDate + "T00:00:00")
    if (walletFilterEndDate) filters.endDate = new Date(walletFilterEndDate + "T23:59:59")
    if (walletFilterType !== "ALL") filters.type = walletFilterType
    if (walletFilterOrigin !== "ALL") filters.origin = walletFilterOrigin

    const res = await getCustomerWalletAction(customerId, filters)
    if (res.success && res.wallet) {
      setWalletInfo({
        id: res.wallet.id,
        saldo_atual: res.wallet.balance,
        total_creditos: res.totalCredits || 0,
        total_debitos: res.totalDebits || 0
      })
      setWalletHistory(res.transactions || [])
    } else {
      setWalletInfo(null)
      setWalletHistory([])
    }
  }, [walletFilterStartDate, walletFilterEndDate, walletFilterType, walletFilterOrigin])

  useEffect(() => {
    if (isOpen && customer?.id) {
      loadWalletData(customer.id)
    }
  }, [isOpen, customer?.id, loadWalletData])

  useEffect(() => {
    if (isOpen && customer) {
      if (customer.children) {
        setFilhos(customer.children.map((f: any) => ({
          id: f.id,
          nome: f.name,
          data_nascimento: f.birthDate ? new Date(f.birthDate).toISOString().substring(0, 10) : "",
          sexo: f.gender || "",
          tamanho_roupa: f.clothingSize || "2",
          tamanho_calcado: f.shoeSize || "",
          observacoes: f.notes || ""
        })))
      } else {
        setFilhos([])
      }
      setSelectedTags(customer.tags || [])

      Promise.all([
        getCustomerHistory(customer.id),
        getCustomerExchangeReturns(customer.id)
      ]).then(([historyRes, returnsRes]) => {
        if (historyRes.success && historyRes.data) {
          setHistoryLogs(historyRes.data.map((h: any) => ({
            id: h.id,
            tipo_acao: h.actionType,
            descricao: h.description,
            created_at: { seconds: new Date(h.createdAt).getTime() / 1000 }
          })))
        }
        if (returnsRes.success && returnsRes.data) {
          setReturnsHistory(returnsRes.data.map((r: any) => ({
            id: r.id,
            type: r.type,
            venda_id: r.originalSaleId,
            vendedor_nome: "Sistema",
            valor_credito: Number(r.totalCredit),
            refundMethod: r.refundMethod,
            financialProcessed: r.financialProcessed,
            created_at: { seconds: new Date(r.createdAt).getTime() / 1000 }
          })))
        }
      })
    }
  }, [isOpen, customer])

  const handleUpdateTags = async (tagName: string) => {
    if (!customer) return
    const tagObj = availableTags.find(t => t.name === tagName)
    if (!tagObj) return

    try {
      if (selectedTags.includes(tagName)) {
        const relToDelete = customer.tagRelations?.find((r: any) => r.tag?.name === tagName)
        if (relToDelete) {
          await removeTagFromCustomer(customer.id, relToDelete.tagId)
        }
        setSelectedTags(prev => prev.filter(t => t !== tagName))
      } else {
        await addTagToCustomer(customer.id, tagObj.id)
        setSelectedTags(prev => [...prev, tagName])
      }
      onUpdate()
      toast({ title: "Tags atualizadas" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">{customer.nome}</DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-slate-500 text-xs">
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {formatPhone(customer.whatsapp_principal)}</span>
                {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
              </div>
            </div>
            <Badge className={customer.status === 'vip' ? "bg-amber-100 text-amber-800 border-amber-200 font-bold" : "bg-indigo-50 text-indigo-700 border-indigo-200"}>
              {customer.status?.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="ficha" className="w-full mt-4">
          <TabsList className="bg-white border w-full justify-start gap-1 p-1">
            <TabsTrigger value="ficha" className="flex items-center gap-1.5">Ficha Básica</TabsTrigger>
            <TabsTrigger value="filhos" className="flex items-center gap-1.5"><Baby className="h-4 w-4 text-emerald-600" /> Dependentes ({filhos.length})</TabsTrigger>
            <TabsTrigger value="carteira" className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-indigo-600" /> Créditos/Carteira</TabsTrigger>
            <TabsTrigger value="trocas" className="flex items-center gap-1.5">Trocas ({returnsHistory.length})</TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1.5"><History className="h-4 w-4" /> Histórico CRM ({historyLogs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ficha" className="space-y-4 pt-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg border">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">CPF</span>
                  <span className="text-slate-800 font-medium block mt-1">{customer.cpf || "Não informado"}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Data de Nascimento</span>
                  <span className="text-slate-800 font-medium block mt-1">
                    {customer.data_nascimento ? new Date(customer.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {customer.observacoes && (
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Notas de Atendimento</span>
                    <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed">{customer.observacoes}</p>
                  </div>
                )}

                <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Etiquetas de Segmentação</span>
                  
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableTags.map((tag) => {
                      const active = selectedTags.includes(tag.name)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleUpdateTags(tag.name)}
                          disabled={!canUpdate}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                            active
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="filhos">
            <CustomerChildrenTab customer={customer} filhos={filhos} onUpdate={onUpdate} />
          </TabsContent>

          <TabsContent value="carteira">
            <CustomerWalletTab 
              customer={customer} 
              walletInfo={walletInfo} 
              walletHistory={walletHistory} 
              walletFilterStartDate={walletFilterStartDate}
              setWalletFilterStartDate={setWalletFilterStartDate}
              walletFilterEndDate={walletFilterEndDate}
              setWalletFilterEndDate={setWalletFilterEndDate}
              walletFilterType={walletFilterType}
              setWalletFilterType={setWalletFilterType}
              walletFilterOrigin={walletFilterOrigin}
              setWalletFilterOrigin={setWalletFilterOrigin}
              canUpdate={canUpdate}
              onUpdate={onUpdate} 
            />
          </TabsContent>

          <TabsContent value="trocas" className="space-y-4 pt-4 text-xs">
            <h3 className="font-bold text-slate-800 text-sm">Histórico de Trocas (PDV)</h3>
            {returnsHistory.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
                Nenhuma troca registrada para este comprador.
              </div>
            ) : (
              <div className="border rounded-xl divide-y bg-white">
                {returnsHistory.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <strong className="text-slate-800">Troca #{item.venda_id?.substring(0,8) || item.id?.substring(0,8)}</strong>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Responsável: {item.vendedor_nome || "Balcão"}</p>
                    </div>
                    <div className="text-right">
                      <strong className="text-indigo-600">R$ {(safeNumber(item.valor_credito ?? item.valor) ?? 0).toFixed(2)}</strong>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {item.created_at ? new Date(item.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico">
            <CustomerHistoryTab historyLogs={historyLogs} />
          </TabsContent>

        </Tabs>

        <DialogFooter className="border-t pt-4 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar Ficha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
