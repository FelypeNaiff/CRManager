"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSaleAction } from "@/lib/sales/actions/get-sale-action";
import { createReturnAction } from "@/lib/returns/return-actions";
import { getOperationalSettingsAction } from "@/lib/configuracoes/operational-settings-actions";
import { Search, Loader2, RefreshCw, CheckCircle, ShieldCheck, CreditCard, Banknote, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AuthorizationDialog } from "@/components/authorization/authorization-dialog";

interface CartItemReturn {
  variantId: string;
  name: string;
  sku: string;
  purchasedQty: number;
  unitPrice: number;
  quantity: number;
  condition: "RESALE" | "DAMAGED" | "DISCARD";
}

export default function DevolucoesPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();

  // Settings
  const [settings, setSettings] = useState<any>(null);

  // Search states
  const [searchSaleId, setSearchSaleId] = useState("");
  const [loadingSale, setLoadingSale] = useState(false);
  const [sale, setSale] = useState<any>(null);

  // Return form states
  const [returnItems, setReturnItems] = useState<CartItemReturn[]>([]);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"WALLET" | "CASH" | "PIX">("WALLET");
  const [processing, setProcessing] = useState(false);
  
  const [authorizationId, setAuthorizationId] = useState("");
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    if (activeProfile?.empresaId) {
      getOperationalSettingsAction().then(res => {
        if (res.success) {
          setSettings(res.data);
          // Set default refund method from settings
          if (res.data.walletDefaultRefundMethod) {
            setRefundMethod(res.data.walletDefaultRefundMethod as any);
          }
        }
      });
    }
  }, [activeProfile]);

  const handleSearchSale = async () => {
    if (!searchSaleId.trim()) return;
    setLoadingSale(true);
    setSale(null);
    setReturnItems([]);
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
        setReturnItems(mapped);
      } else {
        toast({ variant: "destructive", title: "Erro ao buscar venda", description: res.error || "Venda não encontrada." });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." });
    } finally {
      setLoadingSale(false);
    }
  };

  const handleUpdateItemQty = (variantId: string, qty: number) => {
    setReturnItems(prev =>
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
    setReturnItems(prev =>
      prev.map(i => (i.variantId === variantId ? { ...i, condition: cond } : i))
    );
  };

  const calculatedRefund = returnItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

  const handleSubmitReturn = async (authId?: string) => {
    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." });
      return;
    }

    setProcessing(true);
    try {
      const res = await createReturnAction({
        companyId: activeProfile?.empresaId || "",
        saleId: sale.id,
        refundMethod,
        reason,
        items: itemsToReturn.map(i => ({
          variantId: i.variantId,
          quantity: i.quantity,
          condition: i.condition
        })),
        authorizationId: authId
      });

      if (res.success) {
        let desc = `Reembolso de R$ ${calculatedRefund.toFixed(2)} processado via carteira digital.`;
        if (refundMethod === "PIX") desc = `Devolução registrada. Reembolso de R$ ${calculatedRefund.toFixed(2)} será efetuado via PIX no Financeiro.`;
        if (refundMethod === "CASH") desc = `Devolução registrada. Reembolso de R$ ${calculatedRefund.toFixed(2)} será pago em dinheiro no Caixa.`;

        toast({ title: "Devolução realizada com sucesso!", description: desc });
        
        // Reset state
        setSale(null);
        setReturnItems([]);
        setReason("");
        setAuthorizationId("");
        setShowAuthDialog(false);
      } else {
        if (res.requireAuthorization) {
          setAuthorizationId(res.authorizationId);
          setShowAuthDialog(true);
        } else {
          toast({ variant: "destructive", title: "Erro ao processar devolução", description: res.error });
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro interno", description: err.message || "Erro ao criar devolução." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw className="text-indigo-600 h-6 w-6" /> Devoluções de Vendas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Registre devoluções de mercadorias e processe reembolsos via Carteira, PIX ou Dinheiro.
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
          {/* Listagem de Itens para Devolução */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold text-slate-700">Selecione os itens para Devolução</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="divide-y border rounded-xl overflow-hidden bg-white">
                  {returnItems.map(item => (
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
                            <option value="RESALE">Nãovo (Revenda)</option>
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
                  placeholder="Ex: Defeito de fabricação, desistência da compra..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="text-xs"
                />
              </CardContent>
            </Card>
          </div>

          {/* Resumo da Devolução, Método de Estorno e Ações */}
          <div className="space-y-6">
            <Card className="border border-slate-100 shadow-sm bg-slate-50">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-sm font-bold text-slate-700">Resumo do Reembolso</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between"><span>Venda ID:</span> <span className="font-bold text-slate-800">#{sale.id.slice(0, 8)}</span></div>
                  <div className="flex justify-between"><span>Cliente:</span> <span className="font-bold text-slate-800">{sale.customer?.name || "Sem cliente"}</span></div>
                  <div className="flex justify-between"><span>Total da Venda:</span> <span className="font-bold text-slate-800">R$ {Number(sale.totalAmount).toFixed(2)}</span></div>
                </div>

                {/* Escolha do Método de Estorno */}
                <div className="space-y-2 border-t pt-3">
                  <span className="text-xs font-bold text-slate-700 block mb-1">Método de Reembolso</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setRefundMethod("WALLET")}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                        refundMethod === "WALLET"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Wallet className="h-4 w-4 mb-1" />
                      <span className="text-[9px]">Carteira</span>
                    </button>
                    <button
                      onClick={() => setRefundMethod("PIX")}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                        refundMethod === "PIX"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <CreditCard className="h-4 w-4 mb-1" />
                      <span className="text-[9px]">PIX</span>
                    </button>
                    <button
                      onClick={() => setRefundMethod("CASH")}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                        refundMethod === "CASH"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Banknote className="h-4 w-4 mb-1" />
                      <span className="text-[9px]">Dinheiro</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-700">Reembolso Total:</span>
                  <span className="text-2xl font-black text-indigo-600">R$ {calculatedRefund.toFixed(2)}</span>
                </div>

                {settings?.returnRequireAuthorization && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-[10px] flex gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Autorização de PIN Necessária</p>
                      <p className="mt-0.5 text-slate-600">Um PIN de supervisor é requerido para autorizar esta devolução.</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => handleSubmitReturn()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 flex items-center justify-center gap-1.5"
                  disabled={processing || calculatedRefund <= 0}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Concluir Devolução
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <AuthorizationDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        authorizationId={authorizationId}
        authorizationType="RETURN"
        title="Autorização de Devolução"
        description="Esta devolução exige aprovação de um gerente."
        amount={calculatedRefund}
        onAuthorized={(auth) => handleSubmitReturn(auth.id)}
      />
    </div>
  );
}
