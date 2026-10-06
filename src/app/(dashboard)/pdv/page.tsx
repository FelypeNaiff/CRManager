"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ShoppingCart, Search, User, Store, Plus, Minus, Trash2, 
  CreditCard, Banknote, HelpCircle, CheckCircle, Printer, Loader2, Play
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

import { searchVariantsAction, searchCustomersAction } from "@/lib/sales/actions/search-sales-entities-action";
import { listSellersAction } from "@/lib/sales/actions/list-sellers-action";
import { listPaymentMethodsAction } from "@/lib/sales/actions/list-payment-methods-action";
import { createSaleAction } from "@/lib/sales/actions/create-sale-action";
import { saveDraftSaleAction, getDraftSaleAction } from "@/lib/sales/actions/draft-sale-actions";

type CartItem = {
  id: string; // pseudo-id to avoid react key collisions
  variant: any;
  quantity: number;
  discountType: "PERCENTAGE" | "AMOUNT";
  discountValue: number;
};

export default function PdvPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get("draftId");

  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Data Dictionaries
  const [sellers, setSellers] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Sale State
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [sellerId, setSellerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [globalDiscountType, setGlobalDiscountType] = useState<"PERCENTAGE" | "AMOUNT">("AMOUNT");
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);

  // Search State
  const [productQuery, setProductQuery] = useState("");
  const [foundVariants, setFoundVariants] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<{paymentMethodId: string, amount: number, installments: number}[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState("");
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Modal State
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  // Fetch initial data
  useEffect(() => {
    async function load() {
      try {
        const [sellersRes, pmRes] = await Promise.all([
          listSellersAction("AUTO"),
          listPaymentMethodsAction("AUTO")
        ]);
        if (sellersRes.success && sellersRes.sellers) {
          setSellers(sellersRes.sellers);
          if (sellersRes.sellers.length > 0) setSellerId(sellersRes.sellers[0].id);
        }
        if (pmRes.success && pmRes.paymentMethods) {
          setPaymentMethods(pmRes.paymentMethods);
          if (pmRes.paymentMethods.length > 0) setCurrentPaymentMethod(pmRes.paymentMethods[0].id);
        }

        if (draftIdParam) {
          const draftRes = await getDraftSaleAction(draftIdParam);
          if (draftRes.success && draftRes.draft) {
            setDraftId(draftRes.draft.id);
            setSellerId(draftRes.draft.sellerId);
            if (draftRes.draft.customerId) {
              setCustomerId(draftRes.draft.customerId);
              setCustomerSearch(draftRes.draft.customerNameSnapshot || "");
            }
            setGlobalDiscountType(draftRes.draft.globalDiscountType as "PERCENTAGE" | "AMOUNT");
            setGlobalDiscountValue(Number(draftRes.draft.globalDiscountValue));
            setItems(draftRes.draft.items.map((i: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              variant: { ...i.variant, salePrice: i.unitPrice }, // Mock for cart
              quantity: i.quantity,
              discountType: i.discountType,
              discountValue: Number(i.discountValue),
            })));
            setPayments(draftRes.draft.payments.map((p: any) => ({
              paymentMethodId: p.paymentMethodId,
              amount: Number(p.amount),
              installments: p.installments
            })));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInitial(false);
        searchInputRef.current?.focus();
      }
    }
    load();
  }, [draftIdParam]);

  // Product Search Debounce
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!productQuery || productQuery.length < 2) {
        setFoundVariants([]);
        return;
      }
      try {
        const res = await searchVariantsAction("AUTO", productQuery);
        if (res.success && res.variants) {
          if (res.variants.length === 1 && res.variants[0].barcode === productQuery) {
            // Auto add exact barcode match
            addItemToCart(res.variants[0]);
            setProductQuery("");
            setFoundVariants([]);
          } else {
            setFoundVariants(res.variants);
          }
        }
      } catch (err) {}
    }, 400);
    return () => clearTimeout(delay);
  }, [productQuery]);

  // Customer Search Debounce
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!customerSearch || customerSearch.length < 2 || customerId) return;
      try {
        const res = await searchCustomersAction("AUTO", customerSearch);
        if (res.success && res.customers) {
          setCustomers(res.customers);
        }
      } catch (err) {}
    }, 400);
    return () => clearTimeout(delay);
  }, [customerSearch, customerId]);

  const addItemToCart = (variant: any) => {
    setItems(prev => {
      const existing = prev.find(i => i.variant.id === variant.id);
      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), variant, quantity: 1, discountType: "AMOUNT", discountValue: 0 }];
    });
    setProductQuery("");
    setFoundVariants([]);
    searchInputRef.current?.focus();
  };

  const updateItemQty = (id: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQ = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const resetPdv = () => {
    setItems([]);
    setCustomerId("");
    setCustomerSearch("");
    setGlobalDiscountValue(0);
    setPayments([]);
    setDraftId(undefined);
    setIsPaymentOpen(false);
    setIsSuccessOpen(false);
    setSuccessData(null);
    router.replace("/pdv");
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Calculations
  const subtotal = useMemo(() => items.reduce((acc, i) => acc + (Number(i.variant.salePrice) * i.quantity), 0), [items]);
  const itemsDiscountAmount = useMemo(() => items.reduce((acc, i) => {
    const itemPrice = Number(i.variant.salePrice);
    if (i.discountType === "AMOUNT") return acc + (i.discountValue * i.quantity);
    return acc + ((itemPrice * i.discountValue / 100) * i.quantity);
  }, 0), [items]);
  
  const subtotalAfterItemsDiscount = subtotal - itemsDiscountAmount;
  const globalDiscountAmount = globalDiscountType === "AMOUNT" ? globalDiscountValue : (subtotalAfterItemsDiscount * globalDiscountValue / 100);
  
  const total = subtotalAfterItemsDiscount - globalDiscountAmount;
  const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingToPay = Math.max(0, total - totalPayments);
  const changeAmount = Math.max(0, totalPayments - total);

  useEffect(() => {
    if (isPaymentOpen && remainingToPay > 0 && payments.length === 0) {
      setCurrentPaymentAmount(remainingToPay.toFixed(2));
    }
  }, [isPaymentOpen, remainingToPay, payments]);

  // Actions
  const handleHoldDraft = async () => {
    if (items.length === 0) return toast({ variant: "destructive", title: "Carrinho vazio" });
    setIsSubmitting(true);
    try {
      const payload = {
        draftId: draftId,
        sellerId,
        customerId: customerId || undefined,
        globalDiscountType,
        globalDiscountValue,
        items: items.map(i => ({
          variantId: i.variant.id,
          quantity: i.quantity,
          discountType: i.discountType,
          discountValue: i.discountValue
        })),
        payments: payments
      };
      const res = await saveDraftSaleAction(payload);
      if (res.success) {
        toast({ title: "Venda guardada em rascunhos." });
        resetPdv();
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPayment = () => {
    const amt = parseFloat(currentPaymentAmount);
    if (isNaN(amt) || amt <= 0) return toast({ variant: "destructive", title: "Valor inválido" });
    setPayments(prev => [...prev, { paymentMethodId: currentPaymentMethod, amount: amt, installments: 1 }]);
    setCurrentPaymentAmount((Math.max(0, remainingToPay - amt)).toFixed(2));
  };

  const handleFinalizeSale = async () => {
    if (remainingToPay > 0 && total > 0) {
      return toast({ variant: "destructive", title: "O pagamento não foi integralizado." });
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        companyId: "AUTO",
        channel: "COUNTER" as const,
        sellerId,
        customerId: customerId || undefined,
        subtotal: subtotal,
        discountAmount: itemsDiscountAmount + globalDiscountAmount,
        totalAmount: total,
        freightAmount: 0,
        globalDiscountType,
        globalDiscountValue,
        items: items.map(i => {
          const itemPrice = Number(i.variant.salePrice);
          const unitDiscount = i.discountType === "AMOUNT" ? i.discountValue : (itemPrice * i.discountValue / 100);
          const tPrice = (itemPrice - unitDiscount) * i.quantity;
          const costPrice = Number(i.variant.costPrice || 0);
          return {
            variantId: i.variant.id,
            quantity: i.quantity,
            discountType: i.discountType,
            discountValue: i.discountValue,
            productNameSnapshot: i.variant.product.name,
            variantNameSnapshot: i.variant.name,
            skuSnapshot: i.variant.sku || '',
            barcodeSnapshot: i.variant.barcode || null,
            unitPrice: itemPrice,
            discount: unitDiscount,
            totalPrice: tPrice,
            costPriceAtSale: costPrice,
            salePriceAtSale: itemPrice,
            marginAtSale: itemPrice > 0 ? ((itemPrice - costPrice) / itemPrice) * 100 : 0
          };
        }),
        payments: payments.map(p => ({
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          installments: p.installments
        })),
        draftId: draftId || undefined
      };
      const res = await createSaleAction(payload);
      if (res.success && res.sale) {
        setSuccessData(res.sale);
        setIsPaymentOpen(false);
        setIsSuccessOpen(true);
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro fatal ao fechar venda." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === "F4") { e.preventDefault(); if (items.length > 0) setIsPaymentOpen(true); }
      if (e.key === "F8") { e.preventDefault(); handleHoldDraft(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, isPaymentOpen]);

  if (loadingInitial) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col bg-[#f0f2f5] -m-4 sm:-m-6 p-4">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-6 py-3 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#1e2229] text-white px-4 py-2 rounded-lg shadow-sm">
            <Store className="h-5 w-5" />
            <span className="font-bold text-lg tracking-tight">NEEX PDV</span>
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-200">Caixa Aberto</Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-4 mr-4 text-sm font-semibold text-slate-500 bg-slate-50 px-4 py-2 rounded-lg border">
            <span><kbd className="bg-slate-200 px-1 rounded text-xs font-mono">F2</kbd> Buscar</span>
            <span><kbd className="bg-slate-200 px-1 rounded text-xs font-mono">F4</kbd> Receber</span>
            <span><kbd className="bg-slate-200 px-1 rounded text-xs font-mono">F8</kbd> Segurar</span>
          </div>

          <Button variant="outline" className="border-dashed" onClick={() => router.push("/comercial/vendas")}>
            <Search className="h-4 w-4 mr-2" /> Recuperar Vendas (Rascunhos)
          </Button>

          <div className="flex items-center gap-2 border-l pl-4">
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger className="w-[180px] bg-slate-100 border-0 h-10 font-semibold shadow-inner">
                <div className="flex items-center gap-2"><User className="h-4 w-4" /> <SelectValue /></div>
              </SelectTrigger>
              <SelectContent>
                {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* Left Column (Product Area & Cart) */}
        <div className="flex-[6.5] flex flex-col gap-4 overflow-hidden">
          
          {/* Main Input */}
          <div className="bg-white rounded-xl shadow-sm p-4 shrink-0 relative z-20">
            <div className="flex items-center gap-3 relative">
              <div className="bg-blue-50 p-3 rounded-lg"><ShoppingCart className="h-6 w-6 text-blue-600" /></div>
              <Input 
                ref={searchInputRef}
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                placeholder="Busque por código de barras ou nome do produto... [F2]"
                className="h-14 text-lg border-2 border-slate-200 focus-visible:border-blue-500 shadow-none px-4"
                autoComplete="off"
              />
            </div>
            
            {/* Search Dropdown */}
            {foundVariants.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border shadow-xl rounded-xl max-h-[300px] overflow-y-auto overflow-x-hidden z-50">
                {foundVariants.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer border-b last:border-0" onClick={() => addItemToCart(v)}>
                    <div>
                      <div className="font-bold text-slate-800">{v.product.name}</div>
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        {v.product.internalCode} • <Badge variant="outline">{v.name !== 'Único' ? v.name : 'Padrão'}</Badge> • Estoque: {v.availableStock}
                      </div>
                    </div>
                    <div className="font-bold text-lg text-green-700">R$ {Number(v.salePrice).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col relative z-10">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 sticky top-0 uppercase text-[11px] font-bold tracking-wider z-10 shadow-sm border-b">
                  <tr>
                    <th className="px-6 py-4">Item / Descrição</th>
                    <th className="px-6 py-4 text-center">Variação</th>
                    <th className="px-6 py-4 text-center">Quantidade</th>
                    <th className="px-6 py-4 text-right">Preço Unit.</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">Carrinho vazio</p>
                        <p className="text-sm">Busque um produto acima ou use um leitor de código de barras</p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const price = Number(item.variant.salePrice);
                      const t = price * item.quantity;
                      return (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50 group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800 text-base">{item.variant.product.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{item.variant.barcode || item.variant.sku}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge variant="outline" className="bg-white">{item.variant.name}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateItemQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                              <span className="w-10 text-center font-bold text-base">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateItemQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-600">R$ {price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right font-bold text-lg text-slate-800">R$ {t.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column (Totals and Client) */}
        <div className="flex-[3.5] flex flex-col gap-4">
          
          <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-4 shrink-0 relative z-20">
            <div className="font-headline font-bold text-lg border-b pb-2">Identificação do Cliente</div>
            <div className="relative">
              {!customerId ? (
                <>
                  <Input 
                    value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Buscar cliente (ou vazio para Consumidor Final)"
                    className="h-12 border-slate-200"
                  />
                  {customers.length > 0 && customerSearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border shadow-xl rounded-xl max-h-[200px] overflow-y-auto z-50">
                      {customers.map(c => (
                        <div key={c.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b text-sm" onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setCustomers([]); }}>
                          <div className="font-bold">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.phone} • {c.cpf}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-full"><User className="h-4 w-4 text-white" /></div>
                    <div>
                      <div className="font-bold text-blue-900">{customerSearch}</div>
                      <div className="text-xs text-blue-600">Cliente Identificado</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-100" onClick={() => { setCustomerId(""); setCustomerSearch(""); }}>Remover</Button>
                </div>
              )}
            </div>
            {!customerId && (
              <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                <Plus className="h-4 w-4 mr-2" /> Cadastro Rápido de Cliente
              </Button>
            )}
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-slate-500">
                <span className="font-semibold text-lg">Subtotal</span>
                <span className="font-bold text-xl">R$ {subtotal.toFixed(2)}</span>
              </div>
              
              <div className="space-y-2 border-y py-4">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="font-semibold">Descontos</span>
                  <span className="text-red-500 font-bold">- R$ {(itemsDiscountAmount + globalDiscountAmount).toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Select value={globalDiscountType} onValueChange={(v:any) => setGlobalDiscountType(v)}>
                    <SelectTrigger className="w-24 bg-slate-50 border-0 h-10 shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AMOUNT">R$</SelectItem>
                      <SelectItem value="PERCENTAGE">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" step="0.01" value={globalDiscountValue || ""} onChange={e => setGlobalDiscountValue(parseFloat(e.target.value) || 0)}
                    className="flex-1 h-10 bg-slate-50 border-0 shadow-inner text-right font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-4">
                <div className="flex justify-between items-end">
                  <span className="font-headline font-bold text-2xl text-slate-800">Total</span>
                  <span className="font-black text-5xl text-green-600 tracking-tight">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <Button 
                className="w-full h-16 text-xl font-bold bg-[#5cb85c] hover:bg-[#4cae4c] text-white shadow-md hover:shadow-lg transition-all"
                onClick={() => {
                  if (items.length === 0) return toast({ variant: "destructive", title: "Carrinho vazio" });
                  setIsPaymentOpen(true);
                }}
              >
                <CheckCircle className="h-6 w-6 mr-3" /> [F4] Receber Venda
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 font-bold text-slate-600 border-slate-300" onClick={handleHoldDraft} disabled={isSubmitting}>
                  [F8] Segurar
                </Button>
                <Button variant="outline" className="flex-1 h-12 font-bold text-red-500 border-red-200 hover:bg-red-50" onClick={resetPdv}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL: PAYMENT */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-slate-50">
          <div className="flex h-[500px]">
            {/* Left Col Payment */}
            <div className="w-1/2 bg-white p-6 border-r flex flex-col">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6 text-slate-400" /> Recebimento</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={currentPaymentMethod} onValueChange={setCurrentPaymentMethod}>
                    <SelectTrigger className="h-12 text-lg font-semibold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Lançamento (R$)</Label>
                  <Input 
                    type="number" step="0.01" 
                    value={currentPaymentAmount} onChange={e => setCurrentPaymentAmount(e.target.value)} 
                    className="h-16 text-3xl font-black text-right pr-4"
                  />
                </div>
                <Button 
                  className="w-full h-12 font-bold bg-[#1e2229] hover:bg-black text-white mt-4"
                  onClick={handleAddPayment}
                  disabled={remainingToPay <= 0}
                >
                  <Plus className="h-5 w-5 mr-2" /> Adicionar Pagamento
                </Button>
              </div>
            </div>

            {/* Right Col Review */}
            <div className="w-1/2 p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-end mb-6 bg-slate-100 p-4 rounded-xl">
                  <span className="text-slate-500 font-semibold text-lg">Total</span>
                  <span className="font-black text-4xl text-slate-800">R$ {total.toFixed(2)}</span>
                </div>

                <div className="space-y-2 max-h-[150px] overflow-y-auto mb-6">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-700">{paymentMethods.find(x => x.id === p.paymentMethodId)?.name}</span>
                        <span className="text-xs text-slate-400">Pago</span>
                      </div>
                      <span className="font-bold text-green-600 text-lg">R$ {p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {payments.length === 0 && <div className="text-center text-slate-400 text-sm py-4 italic">Nenhum pagamento adicionado</div>}
                </div>

                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-slate-500 font-semibold">Falta Pagar</span>
                  <span className="font-bold text-xl text-red-500">R$ {remainingToPay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 pt-4">
                  <span className="text-slate-500 font-semibold">Troco</span>
                  <span className="font-bold text-xl text-blue-600">R$ {changeAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-6">
                <Button 
                  className="w-full h-14 text-xl font-bold bg-[#5cb85c] hover:bg-[#4cae4c] text-white disabled:opacity-50"
                  disabled={remainingToPay > 0 || isSubmitting}
                  onClick={handleFinalizeSale}
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-6 w-6 mx-auto" /> : "Confirmar Venda"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: SUCCESS */}
      <Dialog open={isSuccessOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px] text-center p-8 [&>button]:hidden">
          <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-800 mb-2">Venda Concluída!</DialogTitle>
          <DialogDescription className="text-lg text-slate-500 mb-8">
            Pedido <span className="font-bold text-slate-800">#{successData?.saleNumber || successData?.id?.split('-')[0]}</span> emitido com sucesso.
          </DialogDescription>
          
          <div className="bg-slate-50 p-4 rounded-xl mb-8 space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-slate-500">Valor Recebido</span>
              <span className="font-bold">R$ {(successData?.totalAmount + changeAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Troco</span>
              <span className="font-bold text-blue-600">R$ {changeAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-bold" onClick={() => { /* stub print */ }}>
              <Printer className="mr-2 h-5 w-5" /> Imprimir Cupom
            </Button>
            <Button variant="outline" className="w-full h-12 font-bold text-slate-600" onClick={resetPdv}>
              <Play className="mr-2 h-4 w-4" /> Nova Venda (Enter)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
