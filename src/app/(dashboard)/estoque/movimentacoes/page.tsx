"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Scale, Download, Search, 
  PackageSearch, Loader2, Calendar as CalendarIcon, Package, X 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { 
  getInventoryLedger, 
  getInventoryOverview, 
  createStockAdjustmentAction 
} from "@/lib/inventory/inventory-actions";
import { getProducts } from "@/lib/crm/products-actions";

export default function MovimentacoesEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ rows: any[], total: number, page: number, pageSize: number }>({ rows: [], total: 0, page: 1, pageSize: 20 });
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modals
  const [isNovaOpen, setIsNovaOpen] = useState(false);
  const [isAjusteOpen, setIsAjusteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Nova Movimentação
  const [novaType, setNovaType] = useState<"ENTRADA" | "SAIDA">("ENTRADA");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [documentRef, setDocumentRef] = useState("");

  // Search logic for products in forms
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = { page, pageSize: 20 };
      if (search) filters.document = search; // simple search mapping for now
      if (typeFilter !== "ALL") filters.type = typeFilter;
      if (dateFrom) filters.from = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filters.to = to;
      }

      const res = await getInventoryLedger(filters);
      if (res.rows) {
        setData(res);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar movimentações" });
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, dateFrom, dateTo]);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await getInventoryOverview();
      if (res.warehouses) {
        setWarehouses(res.warehouses);
        const defaultW = res.warehouses.find((w: any) => w.isDefault) || res.warehouses[0];
        if (defaultW) setSelectedWarehouseId(defaultW.id);
      }
    } catch (err) {
      console.error("Erro ao carregar depósitos", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  // Product Search for ComboBox
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!productSearch) return;
      setIsSearchingProducts(true);
      try {
        const res = await getProducts({ search: productSearch, page: 1, pageSize: 15 });
        if (res.success && 'data' in res && res.data) {
          setProducts(res.data as any[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [productSearch]);

  const handleNovaSubmit = async () => {
    if (!selectedVariantId || !selectedWarehouseId || !quantity || !reason) {
      toast({ variant: "destructive", title: "Preencha os campos obrigatórios." });
      return;
    }
    
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast({ variant: "destructive", title: "Quantidade inválida." });
      return;
    }

    setIsSubmitting(true);
    try {
      const finalQty = novaType === "ENTRADA" ? String(qtyNum) : String(-qtyNum);
      const res = await createStockAdjustmentAction({
        warehouseId: selectedWarehouseId,
        variantId: selectedVariantId,
        kind: "DELTA",
        quantity: finalQty,
        reason: `${reason}${documentRef ? ` (Doc: ${documentRef})` : ''}`
      });
      if (res) {
        toast({ title: "Movimentação registrada com sucesso!" });
        setIsNovaOpen(false);
        resetForms();
        loadData();
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message || "Falha ao registrar movimentação." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAjusteSubmit = async () => {
    if (!selectedVariantId || !selectedWarehouseId || quantity === "" || !reason) {
      toast({ variant: "destructive", title: "Preencha os campos obrigatórios." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await createStockAdjustmentAction({
        warehouseId: selectedWarehouseId,
        variantId: selectedVariantId,
        kind: "TARGET",
        quantity: quantity,
        reason: reason
      });
      if (res) {
        toast({ title: "Ajuste de inventário realizado com sucesso!" });
        setIsAjusteOpen(false);
        resetForms();
        loadData();
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message || "Falha ao registrar ajuste." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForms = () => {
    setSelectedProductId("");
    setSelectedVariantId("");
    setQuantity("");
    setReason("");
    setDocumentRef("");
    setNovaType("ENTRADA");
    setProductSearch("");
  };

  const renderBadge = (type: string, qty: number) => {
    if (type === "MANUAL_ADJUSTMENT" || type === "INVENTORY_COUNT") {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0">Ajuste</Badge>;
    }
    if (type === "TRANSFER_IN" || type === "TRANSFER_OUT") {
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-0">Transferência</Badge>;
    }
    if (qty > 0) {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">Entrada (+)</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">Saída (-)</Badge>;
  };

  // derived KPIs from current page (ideally would come from backend aggregate)
  const kpiEntradas = data.rows.filter(r => r.quantity > 0).reduce((acc, r) => acc + Number(r.quantity), 0);
  const kpiSaidas = data.rows.filter(r => r.quantity < 0).reduce((acc, r) => acc + Math.abs(Number(r.quantity)), 0);

  const selectedProductObj = products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">&gt;</span>
        <span className="cursor-pointer hover:underline">Estoque</span>
        <span className="mx-2">&gt;</span>
        <span className="font-semibold text-foreground">Movimentações de estoque</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-sidebar-foreground" /> Movimentações de estoque
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Entradas no período</span>
            <div className="bg-green-100 p-2 rounded-lg"><ArrowDownLeft className="h-4 w-4 text-green-700" /></div>
          </div>
          <span className="text-2xl font-bold text-green-700">+{kpiEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Saídas no período</span>
            <div className="bg-red-100 p-2 rounded-lg"><ArrowUpRight className="h-4 w-4 text-red-700" /></div>
          </div>
          <span className="text-2xl font-bold text-red-700">-{kpiSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Total de movimentações</span>
            <div className="bg-blue-100 p-2 rounded-lg"><ArrowLeftRight className="h-4 w-4 text-blue-700" /></div>
          </div>
          <span className="text-2xl font-bold text-foreground">{data.total}</span>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Saldo total atual</span>
            <div className="bg-slate-100 p-2 rounded-lg"><Package className="h-4 w-4 text-slate-700" /></div>
          </div>
          <span className="text-2xl font-bold text-foreground">--</span>
          <p className="text-xs text-muted-foreground mt-1">Consulte Posição de Estoque</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-2">
          <Button className="bg-[#1e2229] hover:bg-black text-white h-8 rounded-sm px-3 text-[13px]" onClick={() => { resetForms(); setIsNovaOpen(true); }}>
            + Nova movimentação
          </Button>
          <Button variant="outline" className="h-8 rounded-sm px-3 text-[13px] border-slate-300 hover:bg-slate-50" onClick={() => { resetForms(); setIsAjusteOpen(true); }}>
            <Scale className="h-3.5 w-3.5 mr-2" /> Ajuste de estoque / Balanço
          </Button>
          <Button variant="ghost" className="h-8 rounded-sm px-3 text-[13px] text-slate-600">
            <Download className="h-3.5 w-3.5 mr-2" /> Exportar extrato
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 border rounded-sm px-2 bg-white">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 border-0 shadow-none w-32 px-1 text-[13px]" />
            <span className="text-muted-foreground text-[13px]">até</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 border-0 shadow-none w-32 px-1 text-[13px]" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-40 text-[13px] bg-white rounded-sm border-gray-300">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os tipos</SelectItem>
              <SelectItem value="PURCHASE">Entradas (+)</SelectItem>
              <SelectItem value="SALE">Saídas (-)</SelectItem>
              <SelectItem value="MANUAL_ADJUSTMENT">Ajustes de inventário</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Input 
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Doc/Referência" 
              className="h-8 rounded-sm w-[200px] border-gray-300 text-[13px] pr-8"
            />
            <Button size="icon" variant="ghost" className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left whitespace-nowrap">
            <thead className="text-foreground uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Data / Hora</th>
                <th className="px-4 py-3 font-semibold">Produto / Variação</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold text-right">Qtd. Movimentada</th>
                <th className="px-4 py-3 font-semibold text-right">Saldo Anterior</th>
                <th className="px-4 py-3 font-semibold text-right">Saldo Posterior</th>
                <th className="px-4 py-3 font-semibold">Depósito</th>
                <th className="px-4 py-3 font-semibold">Motivo / Documento</th>
                <th className="px-4 py-3 font-semibold">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando movimentações...
                  </td>
                </tr>
              ) : data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Nenhuma movimentação encontrada para os filtros.</td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(row.occurredAt), "dd/MM/yyyy HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{row.variant.product.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.variant.product.internalCode} • {row.variant.name !== 'Único' ? row.variant.name : 'Padrão'}
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderBadge(row.type, Number(row.quantity))}</td>
                    <td className={`px-4 py-3 text-right font-bold ${Number(row.quantity) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(row.quantity) > 0 ? '+' : ''}{Number(row.quantity).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{Number(row.balanceBefore).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(row.balanceAfter).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.warehouse.name}</td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[200px]" title={row.reason || ""}>{row.reason || "-"}</div>
                      {row.documentId && <div className="text-[11px] font-mono text-slate-500 mt-0.5">{row.documentId}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">Operador Padrão</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Placeholder */}
      <div className="flex justify-between items-center bg-white p-3 border rounded-sm">
        <span className="text-[12px] text-muted-foreground">Total de registros: {data.total}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>Anterior</Button>
          <span className="text-sm px-4 py-2 bg-gray-50 border rounded-sm">Página {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={loading || data.rows.length < data.pageSize}>Próximo</Button>
        </div>
      </div>

      {/* MODAL 1: Nova Movimentação */}
      <Dialog open={isNovaOpen} onOpenChange={setIsNovaOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-slate-500" /> Lançar Movimentação de Estoque</DialogTitle>
            <DialogDescription>Insira uma entrada ou saída manual no estoque do sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de movimento *</Label>
              <RadioGroup value={novaType} onValueChange={(v) => setNovaType(v as any)} className="flex gap-4">
                <div className={`flex items-center space-x-2 border p-3 rounded-lg flex-1 cursor-pointer transition-colors ${novaType === 'ENTRADA' ? 'bg-green-50 border-green-200' : 'hover:bg-slate-50'}`} onClick={() => setNovaType('ENTRADA')}>
                  <RadioGroupItem value="ENTRADA" id="r1" />
                  <Label htmlFor="r1" className="cursor-pointer font-bold text-green-700">[+] Entrada</Label>
                </div>
                <div className={`flex items-center space-x-2 border p-3 rounded-lg flex-1 cursor-pointer transition-colors ${novaType === 'SAIDA' ? 'bg-red-50 border-red-200' : 'hover:bg-slate-50'}`} onClick={() => setNovaType('SAIDA')}>
                  <RadioGroupItem value="SAIDA" id="r2" />
                  <Label htmlFor="r2" className="cursor-pointer font-bold text-red-700">[-] Saída</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Busque o Produto *</Label>
                <div className="relative">
                  <Input placeholder="Digite nome, código..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pr-10" />
                  {isSearchingProducts && <Loader2 className="absolute right-3 top-2 h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
                {products.length > 0 && productSearch && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-white absolute z-10 w-full max-w-[550px] shadow-lg">
                    {products.map(p => (
                      <div key={p.id} className="p-2 hover:bg-slate-100 cursor-pointer text-sm" onClick={() => { setSelectedProductId(p.id); setProductSearch(p.name); setProducts([]); setSelectedVariantId(p.variants[0]?.id || ""); }}>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-slate-500">Cod: {p.internalCode}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Variação do Produto *</Label>
                <Select value={selectedVariantId} onValueChange={setSelectedVariantId} disabled={!selectedProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {selectedProductObj?.variants?.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Depósito *</Label>
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade ({selectedProductObj?.salesUnit || 'UN'}) *</Label>
                <Input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00 (Opcional)" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Motivo *</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Compra avulsa, avaria..." />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Documento / Referência</Label>
                <Input value={documentRef} onChange={e => setDocumentRef(e.target.value)} placeholder="Ex: NF-e 1234, Pedido 502..." />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setIsNovaOpen(false)}>Cancelar</Button>
            <Button onClick={handleNovaSubmit} disabled={isSubmitting} className="bg-[#1e2229] hover:bg-black text-white">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar Movimentação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Ajuste de Estoque / Balanço */}
      <Dialog open={isAjusteOpen} onOpenChange={setIsAjusteOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2"><Scale className="h-5 w-5 text-slate-500" /> Ajustar Saldo de Estoque</DialogTitle>
            <DialogDescription>Acerto de inventário rápido. Informe quanto de fato há na prateleira.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto a ajustar *</Label>
              <div className="relative">
                <Input placeholder="Digite nome, código..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                {isSearchingProducts && <Loader2 className="absolute right-3 top-2 h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              {products.length > 0 && productSearch && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-white absolute z-10 w-full max-w-[450px] shadow-lg">
                    {products.map(p => (
                      <div key={p.id} className="p-2 hover:bg-slate-100 cursor-pointer text-sm" onClick={() => { setSelectedProductId(p.id); setProductSearch(p.name); setProducts([]); setSelectedVariantId(p.variants[0]?.id || ""); }}>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-slate-500">Cod: {p.internalCode}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            {selectedVariantId && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-semibold text-slate-700">Saldo Atual no Sistema:</p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {Number(selectedProductObj?.variants?.find((v:any) => v.id === selectedVariantId)?.currentStock || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})} {selectedProductObj?.salesUnit}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depósito *</Label>
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Novo Saldo Contado *</Label>
                <Input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Ex: 15.00" className="text-lg font-bold" />
              </div>
            </div>
            
            {quantity && selectedVariantId && (
              <div className={`p-2 rounded-md text-sm border font-medium flex items-center gap-2 ${
                Number(quantity) - Number(selectedProductObj?.variants?.find((v:any) => v.id === selectedVariantId)?.currentStock || 0) >= 0 
                  ? "bg-green-50 text-green-700 border-green-200" 
                  : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {Number(quantity) - Number(selectedProductObj?.variants?.find((v:any) => v.id === selectedVariantId)?.currentStock || 0) >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                Diferença calculada: {(Number(quantity) - Number(selectedProductObj?.variants?.find((v:any) => v.id === selectedVariantId)?.currentStock || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} {selectedProductObj?.salesUnit}
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo do ajuste *</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Inventário semanal de rotina..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setIsAjusteOpen(false)}>Cancelar</Button>
            <Button onClick={handleAjusteSubmit} disabled={isSubmitting} className="bg-[#1e2229] hover:bg-black text-white">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar Ajuste
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
