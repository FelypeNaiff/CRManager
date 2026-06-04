const fs = require('fs');

const content = `"use client"

import React, { useMemo, useState, useEffect } from "react"
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
import { 
  Repeat, 
  Search, 
  Loader2, 
  Plus, 
  AlertCircle, 
  Calendar, 
  Wallet, 
  CheckCircle, 
  Package, 
  ArrowLeftRight, 
  Clock,
  FileText
} from "lucide-react"
import { useProfile } from "@/lib/contexts/profile-context"
import { toast } from "@/hooks/use-toast"
import { useSearchParams } from "next/navigation"
import { listExchangeReturns, createExchangeReturnAction, getCustomers } from "@/lib/crm/actions"
import { listSalesAction } from "@/lib/sales/actions/list-sales-action"

const emptyForm = {
  cliente_id: "",
  venda_id: "",
  produto_id: "",
  quantidade: 1,
  valor_unitario: 0,
  valor_total: 0,
  motivo: "tamanho",
  tipo: "TROCA",
  destino_produto: "retorna_estoque",
  gera_credito: true,
  valor_credito: 0,
  status: "finalizado",
  observacao: ""
}

export default function TrocasDevolucoesPage() {
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || ""
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab")

  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("historico")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const [returns, setReturns] = useState<any[]>([])
  const [isLoadingReturns, setIsLoadingReturns] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [clients, setClients] = useState<any[]>([])
  const [customerSales, setCustomerSales] = useState<any[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  const fetchData = async () => {
    setIsLoadingReturns(true)
    const [resRet, resCli] = await Promise.all([
      listExchangeReturns(),
      getCustomers()
    ])
    if (resRet.success) {
      setReturns(resRet.data)
    } else {
      setError(resRet.error as string)
    }
    if (resCli.success) {
      setClients(resCli.data)
    }
    setIsLoadingReturns(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (tabParam) {
      if (tabParam === "nova") {
        handleOpenCreate()
      } else if (["aberto", "finalizadas", "creditos", "historico"].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    }
  }, [tabParam])

  const clientsMap = useMemo(() => {
    return clients.reduce((acc: Record<string, any>, c: any) => {
      acc[c.id] = c
      return acc
    }, {})
  }, [clients])

  useEffect(() => {
    async function fetchSales() {
      if (!form.cliente_id) {
        setCustomerSales([])
        setForm(p => ({ ...p, venda_id: "", produto_id: "" }))
        return
      }
      setIsLoadingSales(true)
      try {
        const res = await listSalesAction(tenantId, { customerId: form.cliente_id })
        if (res.success) {
          setCustomerSales(res.data)
        }
      } catch (e) {
        console.error("Erro ao carregar vendas:", e)
      } finally {
        setIsLoadingSales(false)
      }
    }
    fetchSales()
  }, [form.cliente_id, tenantId])

  useEffect(() => {
    async function fetchSaleItems() {
      if (!form.venda_id) {
        setSaleItems([])
        setForm(p => ({ ...p, produto_id: "" }))
        return
      }
      setIsLoadingItems(true)
      try {
        const sale = customerSales.find(s => s.id === form.venda_id)
        if (sale && sale.items) {
          setSaleItems(sale.items)
        }
      } catch (e) {
        console.error("Erro ao carregar itens:", e)
      } finally {
        setIsLoadingItems(false)
      }
    }
    fetchSaleItems()
  }, [form.venda_id, customerSales])

  const handleProductChange = (productId: string) => {
    const item = saleItems.find((x: any) => x.variantId === productId)
    const price = Number(item?.totalPrice || 0) / Number(item?.quantity || 1)
    
    setForm(p => {
      const total = Number(p.quantidade || 1) * price
      return {
        ...p,
        produto_id: productId,
        valor_unitario: price,
        valor_total: total,
        valor_credito: p.gera_credito ? total : 0
      }
    })
  }

  const handleQtyChange = (qty: number) => {
    setForm(p => {
      const total = qty * Number(p.valor_unitario || 0)
      return {
        ...p,
        quantidade: qty,
        valor_total: total,
        valor_credito: p.gera_credito ? total : 0
      }
    })
  }

  const handleGeraCreditoChange = (val: boolean) => {
    setForm(p => ({
      ...p,
      gera_credito: val,
      valor_credito: val ? p.valor_total : 0
    }))
  }

  const filteredReturns = useMemo(() => {
    return returns
      .filter((r: any) => {
        if (activeTab === "aberto") return r.status === "PENDING"
        if (activeTab === "finalizadas") return r.status === "COMPLETED"
        if (activeTab === "creditos") return r.gera_credito === true
        return true
      })
      .filter((r: any) => {
        const search = searchTerm.toLowerCase()
        return (
          r.client?.nome?.toLowerCase().includes(search) ||
          r.product?.nome?.toLowerCase().includes(search) ||
          r.motivo?.toLowerCase().includes(search) ||
          r.venda_id?.toLowerCase().includes(search)
        )
      })
  }, [returns, activeTab, searchTerm])

  const handleOpenCreate = () => {
    setForm(emptyForm)
    setCustomerSales([])
    setSaleItems([])
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.cliente_id || !form.produto_id || !form.quantidade || !form.valor_unitario) {
      return toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos obrigatórios." })
    }

    setIsSaving(true)
    try {
      const res = await createExchangeReturnAction(form)
      if (res.success) {
        toast({ title: "Sucesso", description: "Troca/Devolução gravada com sucesso." })
        setIsDialogOpen(false)
        fetchData()
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error as string })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Repeat className="h-8 w-8 text-indigo-600 animate-spin-slow" /> Trocas & Devoluções
          </h1>
          <p className="text-muted-foreground text-sm">Registre devoluções vinculando vendas originais, estoques de produtos e atualizações de crédito automáticas.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 font-medium" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" /> Nova Troca/Devolução
        </Button>
      </div>

      <div className="flex border-b border-slate-200 gap-6">
        {[
          { id: "historico", label: "Histórico Completo", icon: Clock },
          { id: "aberto", label: "Em Aberto", icon: Clock },
          { id: "finalizadas", label: "Finalizadas", icon: CheckCircle },
          { id: "creditos", label: "Créditos Gerados", icon: Wallet },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={\`flex items-center gap-1.5 pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all \${
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }\`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente, produto, motivo ou código de venda..."
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

      {isLoadingReturns ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-muted-foreground text-xs">Carregando ocorrências...</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-slate-50/40 text-muted-foreground text-xs">
          Nenhuma ocorrência localizada para esta aba ou busca.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1">
          {filteredReturns.map((item: any, idx: number) => {
            return (
              <Card key={idx} className="overflow-hidden border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3">
                    <div className={\`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 \${
                      item.tipo === "RETURN" ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                    }\`}>
                      <Repeat className="h-4 w-4" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-sm font-bold text-slate-800">{item.client?.nome || "Consumidor"}</strong>
                        <Badge className={
                          item.tipo === "EXCHANGE" ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }>
                          {item.tipo}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                          Status: {item.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          <span>Produto: <strong>{item.product?.nome || "Carregando..."}</strong> ({item.quantidade}x)</span>
                        </div>
                        {item.venda_id && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Venda Original: <strong className="font-mono">{item.venda_id.substring(0, 8)}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                          <span>Motivo: <strong className="capitalize">{item.motivo}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center md:flex-col justify-between md:items-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 shrink-0 border-slate-100">
                    <div className="text-right">
                      <p className="text-slate-400 text-[10px]">Total Devolvido</p>
                      <strong className="text-sm text-slate-800">R$ {item.valor_total?.toFixed(2)}</strong>
                    </div>
                    {item.gera_credito && (
                      <div className="text-right bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 text-emerald-700 font-medium">
                        + R$ {item.valor_credito?.toFixed(2)} Crédito
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" /> Registrar Troca ou Devolução
            </DialogTitle>
            <DialogDescription>
              Selecione o cliente e a venda original para processar devoluções e creditar a carteira de saldos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-600">1. Cliente Responsável *</Label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(p => ({ ...emptyForm, cliente_id: e.target.value }))}
                  className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-600">2. Venda Original (Obrigatório)</Label>
                <select
                  value={form.venda_id}
                  onChange={e => setForm(p => ({ ...p, venda_id: e.target.value, produto_id: "" }))}
                  disabled={!form.cliente_id || isLoadingSales}
                  className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">Selecione a venda original...</option>
                  {customerSales.map(v => (
                    <option key={v.id} value={v.id}>
                      Venda #{v.id?.substring(0, 8)} - R$ {Number(v.totalAmount || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
                {isLoadingSales && <Loader2 className="h-3 w-3 animate-spin text-slate-400 mt-1" />}
              </div>

              <div className="space-y-1.5 border p-3 rounded-lg bg-slate-50/50">
                <Label className="font-semibold text-slate-600">3. Item Vendido *</Label>
                <select
                  value={form.produto_id}
                  onChange={e => handleProductChange(e.target.value)}
                  disabled={isLoadingItems || !form.venda_id}
                  className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Selecionar item vendido...</option>
                  {saleItems.map(item => (
                    <option key={item.variantId} value={item.variantId}>
                      {item.variant?.product?.name || item.variant?.name || "Produto"} ({Number(item.quantity)}x)
                    </option>
                  ))}
                </select>
                {isLoadingItems && <Loader2 className="h-3 w-3 animate-spin text-slate-400 mt-1" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Quantidade *</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={form.quantidade} 
                    onChange={e => handleQtyChange(Math.max(1, Number(e.target.value)))} 
                  />
                </div>
                <div className="space-y-1">
                  <Label>Preço Unitário (R$) *</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    disabled
                    value={form.valor_unitario} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-4 md:mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo de Ocorrência</Label>
                  <Select value={form.tipo} onValueChange={(v: any) => setForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXCHANGE">Troca</SelectItem>
                      <SelectItem value="RETURN">Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Motivo da Ocorrência</Label>
                  <Select value={form.motivo} onValueChange={(v: any) => setForm(p => ({ ...p, motivo: v }))}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tamanho">Tamanho</SelectItem>
                      <SelectItem value="defeito">Defeito</SelectItem>
                      <SelectItem value="arrependimento">Arrependimento</SelectItem>
                      <SelectItem value="presente repetido">Presente Repetido</SelectItem>
                      <SelectItem value="cor/modelo">Cor/Modelo</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Destinação Física do Produto</Label>
                <Select value={form.destino_produto} onValueChange={(v: any) => setForm(p => ({ ...p, destino_produto: v }))}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retorna_estoque">Voltar para Estoque Ativo</SelectItem>
                    <SelectItem value="avaria">Avaria (Estoque Defeituoso)</SelectItem>
                    <SelectItem value="descarte">Descarte Físico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 border rounded-lg bg-emerald-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-emerald-800">Gerar Crédito Automático?</Label>
                  <input 
                    type="checkbox"
                    checked={form.gera_credito}
                    onChange={e => handleGeraCreditoChange(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                </div>

                {form.gera_credito && (
                  <div className="space-y-1 text-xs">
                    <Label className="text-emerald-700">Valor do Crédito a Gerar (R$)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      className="bg-white border-emerald-200"
                      value={form.valor_credito}
                      onChange={e => setForm(p => ({ ...p, valor_credito: Number(e.target.value) }))}
                    />
                    <span className="text-[9px] text-emerald-600 block mt-1">
                      ✓ Saldo calculado: R$ {form.valor_total.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between gap-4">
            <div className="text-left font-bold text-slate-800 text-sm hidden sm:block">
              Total Calculado: R$ {form.valor_total.toFixed(2)}
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Processar Troca/Devolução
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
`;

fs.writeFileSync('src/app/(dashboard)/crm/trocas/page.tsx', content, 'utf8');
