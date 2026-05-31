"use client"

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
  User, 
  Wallet, 
  CheckCircle, 
  Package, 
  ArrowLeftRight, 
  Archive, 
  Sparkles,
  FileText,
  Clock
} from "lucide-react"
import { useCollection, useMemosupabase-mocks, useFirestore } from "@/supabase-mocks"
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "@/supabase-mocks/firestore"
import { useProfile } from "@/lib/contexts/profile-context"
import { CrmService } from "@/lib/crm-service"
import { toast } from "@/hooks/use-toast"
import { useSearchParams } from "next/navigation"

const emptyForm = {
  cliente_id: "",
  venda_id: "",
  produto_id: "",
  quantidade: 1,
  valor_unitario: 0,
  valor_total: 0,
  motivo: "tamanho", // tamanho, defeito, arrependimento, presente repetido, cor/modelo, outro
  tipo: "TROCA", // TROCA, DEVOLUCAO, CREDITO_LOJA
  destino_produto: "retorna_estoque", // retorna_estoque, avaria, descarte, analise
  gera_credito: true,
  valor_credito: 0,
  status: "finalizado", // em_aberto, finalizado, cancelado
  observacao: ""
}

export default function TrocasDevolucoesPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab")

  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("historico") // historico, aberto, finalizadas, creditos
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  // Dynamic customer and sale tracking
  const [customerSales, setCustomerSales] = useState<any[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [useCatalogProduct, setUseCatalogProduct] = useState(false)

  // 1. Fetch Trocas & Devoluções
  const returnsQuery = useMemosupabase-mocks(() => {
    if (!db) return null
    return query(collection(db, "trocas_devolucoes"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])

  // 2. Fetch Clients
  const clientsQuery = useMemosupabase-mocks(() => {
    if (!db) return null
    return query(collection(db, "clientes"), where("tenant_id", "==", tenantId), where("deleted_at", "==", null))
  }, [db, tenantId])

  // 3. Fetch Global Products (Catalogue fallback)
  const productsQuery = useMemosupabase-mocks(() => {
    if (!db) return null
    return query(collection(db, "produtos"))
  }, [db])

  const { data: returns, isLoading: isLoadingReturns, error } = useCollection(returnsQuery)
  const { data: clients } = useCollection(clientsQuery)
  const { data: globalProducts } = useCollection(productsQuery)

  // Handle sidebar navigation shortcut query strings
  useEffect(() => {
    if (tabParam) {
      if (tabParam === "nova") {
        handleOpenCreate()
      } else if (["aberto", "finalizadas", "creditos", "historico"].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    }
  }, [tabParam])

  // Map Clients by ID for quick display
  const clientsMap = useMemo(() => {
    if (!clients) return {}
    return clients.reduce((acc: Record<string, any>, c: any) => {
      acc[c.id] = c
      return acc
    }, {})
  }, [clients])

  // Map Products by ID for quick display
  const productsMap = useMemo(() => {
    if (!globalProducts) return {}
    return globalProducts.reduce((acc: Record<string, any>, p: any) => {
      acc[p.id] = p
      return acc
    }, {})
  }, [globalProducts])

  // Fetch sales when client is selected
  useEffect(() => {
    async function fetchSales() {
      if (!form.cliente_id || !db) {
        setCustomerSales([])
        setForm(p => ({ ...p, venda_id: "", produto_id: "" }))
        return
      }
      setIsLoadingSales(true)
      try {
        const q = query(collection(db, "vendas"), where("clientId", "==", form.cliente_id))
        const snap = await getDocs(q)
        setCustomerSales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error("Erro ao carregar vendas do cliente:", e)
      } finally {
        setIsLoadingSales(false)
      }
    }
    fetchSales()
  }, [form.cliente_id, db])

  // Fetch items when sale is selected
  useEffect(() => {
    async function fetchSaleItems() {
      if (!form.venda_id || !db) {
        setSaleItems([])
        setForm(p => ({ ...p, produto_id: "" }))
        return
      }
      setIsLoadingItems(true)
      try {
        const q = query(collection(db, `vendas/${form.venda_id}/venda_itens`))
        const snap = await getDocs(q)
        setSaleItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setUseCatalogProduct(false) // default to sale items
      } catch (e) {
        console.error("Erro ao carregar itens da venda:", e)
      } finally {
        setIsLoadingItems(false)
      }
    }
    fetchSaleItems()
  }, [form.venda_id, db])

  // Auto-fill price and recalculate totals
  const handleProductChange = (productId: string) => {
    let price = 0
    if (useCatalogProduct) {
      const p = globalProducts?.find((x: any) => x.id === productId)
      price = Number(p?.preco || 0)
    } else {
      const item = saleItems.find((x: any) => x.produtoId === productId)
      price = Number(item?.precoComDesconto ?? item?.precoUnitario ?? 0)
    }
    
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

  // Filter returns based on selected tab and search term
  const filteredReturns = useMemo(() => {
    if (!returns) return []
    return returns
      .map(r => ({
        ...r,
        client: clientsMap[r.cliente_id] || { nome: "Consumidor Avulso" },
        product: productsMap[r.produto_id] || { nome: "Produto não localizado" }
      }))
      .filter(r => {
        // Tab filtering
        if (activeTab === "aberto") return r.status === "em_aberto"
        if (activeTab === "finalizadas") return r.status === "finalizado"
        if (activeTab === "creditos") return r.gera_credito === true
        return true // historico
      })
      .filter(r => {
        // Search filtering
        const search = searchTerm.toLowerCase()
        return (
          r.client.nome.toLowerCase().includes(search) ||
          r.product.nome.toLowerCase().includes(search) ||
          r.motivo.toLowerCase().includes(search) ||
          r.venda_id?.toLowerCase().includes(search)
        )
      })
      .sort((a, b) => {
        const tA = a.created_at?.seconds || new Date(a.created_at).getTime() / 1000 || 0
        const tB = b.created_at?.seconds || new Date(b.created_at).getTime() / 1000 || 0
        return tB - tA
      })
  }, [returns, clientsMap, productsMap, activeTab, searchTerm])

  const handleOpenCreate = () => {
    setForm(emptyForm)
    setCustomerSales([])
    setSaleItems([])
    setUseCatalogProduct(false)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.cliente_id) {
      return toast({ variant: "destructive", title: "Cliente obrigatório", description: "Selecione um cliente responsável." })
    }
    if (!form.produto_id) {
      return toast({ variant: "destructive", title: "Produto obrigatório", description: "Selecione um produto para devolver." })
    }
    if (!form.quantidade || form.quantidade <= 0) {
      return toast({ variant: "destructive", title: "Quantidade inválida", description: "Informe a quantidade de produtos." })
    }
    if (!form.valor_unitario || form.valor_unitario <= 0) {
      return toast({ variant: "destructive", title: "Valor inválido", description: "Informe o valor unitário." })
    }

    setIsSaving(true)
    try {
      // 1. Create Trocas/Devoluções record in DB
      const dataToSave = {
        ...form,
        tenant_id: tenantId,
        usuario_responsavel: activeProfile?.nome || "System",
        created_at: new Date(),
        updated_at: new Date()
      }
      const savedDoc = await CrmService.createDocument(db, "trocas_devolucoes", dataToSave, activeProfile as any)

      const clientObj = clientsMap[form.cliente_id]
      const productObj = productsMap[form.produto_id]
      const productName = productObj?.nome || "Produto"

      // 2. If gera_credito is true, update customer's wallet balance
      if (form.gera_credito && form.valor_credito > 0) {
        const walletSnap = await getDocs(query(collection(db, "carteiras_clientes"), where("cliente_id", "==", form.cliente_id)))
        if (!walletSnap.empty) {
          const walletDoc = walletSnap.docs[0]
          const walletData = walletDoc.data()
          const saldoAnterior = walletData.saldo_atual || 0
          const saldoPosterior = saldoAnterior + form.valor_credito

          // Save wallet transaction log
          await CrmService.createDocument(db, "movimentacoes_saldo", {
            cliente_id: form.cliente_id,
            carteira_id: walletDoc.id,
            tipo_movimentacao: "ENTRADA",
            origem: form.tipo === "DEVOLUCAO" ? "DEVOLUCAO" : "TROCA",
            valor: form.valor_credito,
            saldo_anterior: saldoAnterior,
            saldo_posterior: saldoPosterior,
            venda_id: form.venda_id || "",
            troca_devolucao_id: savedDoc.id,
            usuario_responsavel: activeProfile?.nome || "System",
            observacao: `Crédito automático gerado por ocorrência de ${form.tipo} ID: ${savedDoc.id}`
          }, activeProfile as any)

          // Update Wallet balances
          await CrmService.updateDocument(db, "carteiras_clientes", walletDoc.id, {
            saldo_atual: saldoPosterior,
            total_creditos_gerados: (walletData.total_creditos_gerados || 0) + form.valor_credito,
            ultima_movimentacao: new Date()
          }, activeProfile as any)
        }
      }

      // 3. Update stock levels based on Destination selection
      if (form.destino_produto === "retorna_estoque") {
        const prodRef = doc(db, "produtos", form.produto_id)
        const prodSnap = await getDoc(prodRef)
        if (prodSnap.exists()) {
          const currentStock = Number(prodSnap.data().estoqueAtual ?? prodSnap.data().estoque ?? 0)
          await updateDoc(prodRef, {
            estoqueAtual: currentStock + Number(form.quantidade)
          })
        }
      } else if (form.destino_produto === "avaria") {
        // Track damages in custom field on product
        const prodRef = doc(db, "produtos", form.produto_id)
        const prodSnap = await getDoc(prodRef)
        if (prodSnap.exists()) {
          const currentAvaria = Number(prodSnap.data().estoqueAvaria || 0)
          await updateDoc(prodRef, {
            estoqueAvaria: currentAvaria + Number(form.quantidade)
          })
        }
      }

      // 4. Save entry in Customer's personal Timeline/History
      await CrmService.createDocument(db, "historico_cliente", {
        cliente_id: form.cliente_id,
        tipo_acao: `${form.tipo} Ocorrência`,
        descricao: `Registrou uma ${form.tipo} de ${form.quantidade}x do produto ${productName}. Destino: ${form.destino_produto}. Crédito Gerado: R$ ${form.valor_credito.toFixed(2)}. Motivo: ${form.motivo}`,
        status: "ativo"
      }, activeProfile as any)

      toast({ 
        title: "Ocorrência salva!", 
        description: `Troca/Devolução gravada com sucesso. Carteira de saldos e estoques atualizados.` 
      })
      setIsDialogOpen(false)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível concluir o registro." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Tabs Menu */}
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
            className={`flex items-center gap-1.5 pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search */}
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
          <p className="text-sm">{(error as any).message || "Erro ao carregar dados do banco."}</p>
        </div>
      )}

      {/* List items */}
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
          {filteredReturns.map((item: any, idx) => {
            const itemDate = item.created_at?.seconds 
              ? new Date(item.created_at.seconds * 1000) 
              : new Date(item.created_at)

            return (
              <Card key={idx} className="overflow-hidden border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      item.tipo === "DEVOLUCAO" ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                    }`}>
                      <Repeat className="h-4 w-4" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-sm font-bold text-slate-800">{item.client?.nome || "Consumidor"}</strong>
                        <Badge className={
                          item.tipo === "TROCA" ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
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
                            <span>Venda Original: <strong className="font-mono">{item.venda_id}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                          <span>Motivo: <strong className="capitalize">{item.motivo}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ArrowLeftRight className="h-3.5 w-3.5 text-slate-400" />
                          <span>Destino Físico: <strong>{item.destino_produto === "retorna_estoque" ? "Voltar ao Estoque" : item.destino_produto}</strong></span>
                        </div>
                      </div>

                      {item.observacao && (
                        <p className="text-[10px] text-slate-400 italic">“{item.observacao}”</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center md:flex-col justify-between md:items-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 shrink-0 border-slate-100">
                    <div className="text-right">
                      <p className="text-slate-400 text-[10px]">Total Devuelto</p>
                      <strong className="text-sm text-slate-800">R$ {item.valor_total?.toFixed(2)}</strong>
                    </div>
                    {item.gera_credito && (
                      <div className="text-right bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 text-emerald-700 font-medium">
                        + R$ {item.valor_credito?.toFixed(2)} Crédito
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-1">
                      <Calendar className="h-3 w-3" />
                      {itemDate.toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* DIALOG NEW EXCHANGE */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" /> Registrar Troca ou Devolução
            </DialogTitle>
            <DialogDescription>
              Selecione o cliente responsável e filtre a venda original para processar devoluções e creditar a carteira de saldos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs grid grid-cols-1 md:grid-cols-2 gap-x-6">
            
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-600">1. Cliente Responsável *</Label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(p => ({ ...emptyForm, cliente_id: e.target.value }))}
                  className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients?.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.whatsapp_principal})</option>
                  ))}
                </select>
                {form.cliente_id && clientsMap[form.cliente_id] && (
                  <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded border mt-1">
                    <span className="text-slate-500">VIP: {clientsMap[form.cliente_id].vip ? "Sim ★" : "Não"}</span>
                    <span className="text-indigo-600 font-semibold">Créditos Ativos: R$ {clientsMap[form.cliente_id].saldo?.toFixed(2) || "0.00"}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-slate-600">2. Venda Original (Opcional)</Label>
                <select
                  value={form.venda_id}
                  onChange={e => setForm(p => ({ ...p, venda_id: e.target.value, produto_id: "" }))}
                  disabled={!form.cliente_id || isLoadingSales}
                  className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">Selecione a venda original...</option>
                  {customerSales.map(v => (
                    <option key={v.id} value={v.id}>
                      Venda #{v.id?.substring(0, 8)} - R$ {v.total?.toFixed(2)} ({v.dataVenda?.seconds ? new Date(v.dataVenda.seconds * 1000).toLocaleDateString("pt-BR") : ""})
                    </option>
                  ))}
                </select>
                {isLoadingSales && <Loader2 className="h-3 w-3 animate-spin text-slate-400 mt-1" />}
              </div>

              <div className="space-y-1.5 border p-3 rounded-lg bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-slate-600">3. Seleção do Produto *</Label>
                  {form.venda_id && (
                    <button 
                      type="button"
                      onClick={() => {
                        setUseCatalogProduct(!useCatalogProduct)
                        setForm(p => ({ ...p, produto_id: "" }))
                      }}
                      className="text-[10px] text-indigo-600 font-bold hover:underline"
                    >
                      {useCatalogProduct ? "Voltar para itens da Venda" : "Pesquisar no catálogo inteiro"}
                    </button>
                  )}
                </div>

                {useCatalogProduct || !form.venda_id ? (
                  <select
                    value={form.produto_id}
                    onChange={e => handleProductChange(e.target.value)}
                    disabled={!form.cliente_id}
                    className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="">Buscar no catálogo completo...</option>
                    {globalProducts?.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} (Ref: {p.codigoInterno || p.codigo || "N/A"}) - R$ {Number(p.preco || 0).toFixed(2)}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={form.produto_id}
                    onChange={e => handleProductChange(e.target.value)}
                    disabled={isLoadingItems}
                    className="w-full h-10 px-3 border rounded-lg bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Selecionar item vendido...</option>
                    {saleItems.map(item => (
                      <option key={item.produtoId} value={item.produtoId}>
                        {item.nomeProduto} ({item.quantidade}x) - Preço: R$ {Number(item.precoComDesconto || item.precoUnitario || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                )}
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
                    value={form.valor_unitario} 
                    onChange={e => setForm(p => {
                      const total = Number(p.quantidade || 1) * Number(e.target.value)
                      return {
                        ...p,
                        valor_unitario: Number(e.target.value),
                        valor_total: total,
                        valor_credito: p.gera_credito ? total : 0
                      }
                    })} 
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4 mt-4 md:mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo de Ocorrência</Label>
                  <Select value={form.tipo} onValueChange={(v: any) => setForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TROCA">Troca</SelectItem>
                      <SelectItem value="DEVOLUCAO">Devolução</SelectItem>
                      <SelectItem value="CREDITO_LOJA">Crédito Avulso</SelectItem>
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
                    <SelectItem value="analise">Enviar para Análise Técnica</SelectItem>
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
                      ✓ Saldo calculado: R$ {form.valor_total.toFixed(2)} (Modificável)
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Status Inicial</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_aberto">Em Aberto (Em processamento)</SelectItem>
                    <SelectItem value="finalizado">Finalizado / Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fobs">Notas / Observações complementares</Label>
                <Input id="fobs" placeholder="Ex: Produto com tag, sem caixa original." value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
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
