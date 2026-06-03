"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSaleAction } from "@/lib/sales/actions/get-sale-action";
import { createExchangeAction } from "@/lib/exchanges/exchange-actions";
import { getOperationalSettingsAction } from "@/lib/configuracoes/operational-settings-actions";
import { Search, Loader2, ArrowLeftRight, CheckCircle, ShieldCheck } from "lucide-react";
import { AuthorizationDialog } from "@/components/authorization/authorization-dialog";
import { toast } from "@/hooks/use-toast";

interface CartItemExchange {
  variantId: string;
  name: string;
  sku: string;
  purchasedQty: number;
  unitPrice: number;
  quantity: number;
  condition: "RESALE" | "DAMAGED" | "DISCARD";
}

export default function TrocasPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();

  // Settings
  const [settings, setSettings] = useState<any>(null);

  // Search states
  const [searchSaleId, setSearchSaleId] = useState("");
  const [loadingSale, setLoadingSale] = useState(false);
  const [sale, setSale] = useState<any>(null);

  // Exchange form states
  const [exchangeItems, setExchangeItems] = useState<CartItemExchange[]>([]);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Authorization Dialog state
  const [authorizationId, setAuthorizationId] = useState("");
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    if (activeProfile?.empresaId) {
      getOperationalSettingsAction().then(res => {
        if (res.success) setSettings(res.data);
      });
    }
  }, [activeProfile]);

  const handleSearchSale = async () => {
    if (!searchSaleId.trim()) return;
    setLoadingSale(true);
    setSale(null);
    setExchangeItems([]);
    try {
      const res = await getSaleAction(searchSaleId.trim());
      if (res.success && res.sale) {
        setSale(res.sale);
        
        // Map items
        const mapped = res.sale.items.map((i: any) => ({
          variantId: i.variantId,
          name: `${i.productNameSnapshot} (${i.variantNameSnapshot})`,
          sku: i.skuSnapshot,
          purchasedQty: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          quantity: 0,
          condition: "RESALE" as const
        }));
        setExchangeItems(mapped);
      } else {
        toast({ variant: "destructive", title: "Erro ao buscar venda", description: res.error || "Venda não encontrada." });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro na busca", description: "Houve um erro ao buscar a venda." });
    } finally {
      setLoadingSale(false);
    }
  };

  const handleUpdateItemQty = (variantId: string, qty: number) => {
    setExchangeItems(prev =>
      prev.map(i => {
        if (i.variantId === variantId) {
          const max = i.purchasedQty;
          const val = Math.max(0, Math.min(max, qty));
          return { ...i, quantity: val };
        }
        return i;
      })
    );
  };

  const handleUpdateItemCondition = (variantId: string, cond: "RESALE" | "DAMAGED" | "DISCARD") => {
    setExchangeItems(prev =>
      prev.map(i => (i.variantId === variantId ? { ...i, condition: cond } : i))
    );
  };

  const calculatedCredit = exchangeItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

  const handleSubmitExchange = async (authId?: string) => {
    const itemsToExchange = exchangeItems.filter(i => i.quantity > 0);
    if (itemsToExchange.length === 0) {
      toast({ variant: "destructive", title: "Nenhum item selecionado", description: "Informe ao menos um item com quantidade maior que zero." });
      return;
    }

    setProcessing(true);
    try {
      const res = await createExchangeAction({
        companyId: activeProfile?.empresaId || "",
        saleId: sale.id,
        reason,
        items: itemsToExchange.map(i => ({
          variantId: i.variantId,
          quantity: i.quantity,
          condition: i.condition
        })),
        authorizationId: authId
      });

      if (res.success) {
        toast({ title: "Troca realizada com sucesso!", description: `Crédito de R$ ${calculatedCredit.toFixed(2)} gerado para o cliente.` });
        // Redirect to sales page or reset
        setSale(null);
        setExchangeItems([]);
        setReason("");
        setAuthorizationId("");
        setShowAuthDialog(false);
      } else {
        if (res.requireAuthorization) {
          setAuthorizationId(res.authorizationId);
          setShowAuthDialog(true);
        } else {
          toast({ variant: "destructive", title: "Erro ao processar troca", description: res.error });
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro interno", description: err.message || "Erro ao criar troca." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowLeftRight className="text-indigo-600 h-6 w-6" /> Trocas de Vendas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gere créditos de trocas controlados para a carteira digital dos clientes.
          </p>
        </div>
      </div>

      {/* Buscar Venda */}
      <Card className="border border-slate-100 shadow-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-bold text-slate-700">Identificar Venda Original</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Digite o ID da Venda..."
              value={searchSaleId}
              onChange={e => setSearchSaleId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearchSale()}
              className="h-9 text-xs"
            />
            <Button onClick={handleSearchSale} className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5" disabled={loadingSale}>
              {loadingSale ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {sale && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Listagem de Itens para Seleção */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold text-slate-700">Selecione os itens para Troca</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="divide-y border rounded-xl overflow-hidden bg-white">
                  {exchangeItems.map(item => (
                    <div key={item.variantId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-xs">{item.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">SKU: {item.sku} &middot; Preço: R$ {item.unitPrice.toFixed(2)} &middot; Comprado: {item.purchasedQty}</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <label className="text-[9px] font-bold text-slate-400 block mb-1">Quantidade</label>
                          <Input
                            type="number"
                            min="0"
                            max={item.purchasedQty}
                            value={item.quantity}
                            onChange={e => handleUpdateItemQty(item.variantId, Number(e.target.value))}
                            className="h-8 text-xs text-center"
                          />
                        </div>
                        
                        <div className="w-32">
                          <label className="text-[9px] font-bold text-slate-400 block mb-1">Condição</label>
                          <select
                            className="w-full border rounded h-8 px-2 text-xs bg-white text-slate-700"
                            value={item.condition}
                            onChange={e => handleUpdateItemCondition(item.variantId, e.target.value as any)}
                          >
                            <option value="RESALE">Novo (Revenda)</option>
                            <option value="DAMAGED">Avariado</option>
                            <option value="DISCARD">Descarte</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold text-slate-700">Justificativa / Motivo</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Input
                  placeholder="Ex: Tamanho não serviu, prefere outra cor..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="text-xs"
                />
              </CardContent>
            </Card>
          </div>

          {/* Resumo da Troca e Ações */}
          <div className="space-y-6">
            <Card className="border border-slate-100 shadow-sm bg-slate-50">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-sm font-bold text-slate-700">Resumo da Operação</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between"><span>Venda ID:</span> <span className="font-bold text-slate-800">#{sale.id.slice(0, 8)}</span></div>
                  <div className="flex justify-between"><span>Cliente:</span> <span className="font-bold text-slate-800">{sale.customer?.name || "Sem cliente"}</span></div>
                  <div className="flex justify-between"><span>Total da Venda:</span> <span className="font-bold text-slate-800">R$ {Number(sale.totalAmount).toFixed(2)}</span></div>
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-700">Crédito Gerado:</span>
                  <span className="text-2xl font-black text-indigo-600">R$ {calculatedCredit.toFixed(2)}</span>
                </div>

                {settings?.exchangeRequireAuthorization && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-[10px] flex gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Autorização de PIN Necessária</p>
                      <p className="mt-0.5 text-slate-600">Uma senha PIN de administrador ou gerente é requerida para concluir a troca.</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => handleSubmitExchange()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 flex items-center justify-center gap-1.5"
                  disabled={processing || calculatedCredit <= 0}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                  Confirmar Troca
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* PIN Authorization Modal */}
      <AuthorizationDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        authorizationId={authorizationId}
        authorizationType="EXCHANGE"
        title="Autorização de Troca"
        description="Esta troca exige aprovação de um gerente."
        amount={calculatedCredit}
        onAuthorized={(auth) => handleSubmitExchange(auth.id)}
      />
    </div>
  );
}
