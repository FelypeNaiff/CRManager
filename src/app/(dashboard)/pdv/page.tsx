"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { searchVariantsAction, searchCustomersAction } from "@/lib/sales/actions/search-sales-entities-action";
import { listSellersAction } from "@/lib/sales/actions/list-sellers-action";
import { listPaymentMethodsAction } from "@/lib/sales/actions/list-payment-methods-action";
import { createSaleAction } from "@/lib/sales/actions/create-sale-action";
import { createQuickCustomerAction } from "@/lib/sales/actions/create-quick-customer-action";
import { getDraftSaleAction, saveDraftSaleAction } from "@/lib/sales/actions/draft-sale-actions";
import { getOperationalSettingsAction } from "@/lib/configuracoes/operational-settings-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ShoppingCart, User, CreditCard, X, Loader2, UserPlus, Minus, Save } from "lucide-react";
import Link from "next/link";

import { AuthorizationDialog } from "@/components/authorization/authorization-dialog";

export default function PDVPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();

  // Search
  const [productQuery, setProductQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searchSuccess, setSearchSuccess] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cart & Sale State
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedSeller, setSelectedSeller] = useState<string>("");
  const [sellers, setSellers] = useState<any[]>([]);
  const [globalDiscountType, setGlobalDiscountType] = useState<"PERCENTAGE" | "AMOUNT">("AMOUNT");
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);

  // Payments State
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  
  // New Payment Form
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentInstallments, setPaymentInstallments] = useState<number>(1);

  // Auth PIN Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [authPin, setAuthPin] = useState("");
  const [authReason, setAuthReason] = useState("");
  const [pinError, setPinError] = useState("");

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickChildren, setQuickChildren] = useState([{ name: "", age: "" }]);
  const [quickCustomerError, setQuickCustomerError] = useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (activeProfile?.empresaId) {
      listSellersAction(activeProfile.empresaId).then(res => {
        if (res.success) setSellers(res.sellers || []);
        if (activeProfile.userId) setSelectedSeller(activeProfile.userId);
      });
      listPaymentMethodsAction(activeProfile.empresaId).then(res => {
        if (res.success) {
          setPaymentMethods(res.paymentMethods || []);
          setPaymentMethodsError("");
        } else {
          setPaymentMethodsError(res.error || "Não foi possível carregar as formas de pagamento.");
        }
      }).catch(() => setPaymentMethodsError("Não foi possível carregar as formas de pagamento."));
      getOperationalSettingsAction().then(res => {
        if (res.success && res.data) {
          setSettings(res.data);
        }
      });
    }
  }, [activeProfile]);

  useEffect(() => {
    if (!activeProfile?.empresaId || draftLoaded) return;
    const requestedDraftId = new URLSearchParams(window.location.search).get('draft');
    if (!requestedDraftId) {
      setDraftLoaded(true);
      return;
    }

    setDraftLoaded(true);
    getDraftSaleAction(requestedDraftId).then(result => {
      if (!result.success || !result.draft) {
        alert(result.error || 'Não foi possível carregar a venda guardada.');
        return;
      }
      const draft = result.draft;
      setDraftId(draft.id);
      setSelectedSeller(draft.sellerId);
      setSelectedCustomer(draft.customer || null);
      setGlobalDiscountType(draft.globalDiscountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'AMOUNT');
      setGlobalDiscountValue(Number(draft.globalDiscountValue || 0));
      setCartItems(draft.items.map((item: any) => ({
        variantId: item.variantId,
        productNameSnapshot: item.productNameSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
        skuSnapshot: item.skuSnapshot,
        barcodeSnapshot: item.barcodeSnapshot || '',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountType: item.discountType || 'AMOUNT',
        discountValue: Number(item.discountValue || 0),
        discount: Number(item.discount || 0),
        costPriceAtSale: Number(item.costPriceAtSale),
        salePriceAtSale: Number(item.salePriceAtSale),
        marginAtSale: Number(item.marginAtSale),
        availableStock: Number(item.variant.availableStock),
      })));
      setPayments(draft.payments.map((payment: any) => ({
        paymentMethodId: payment.paymentMethodId,
        name: payment.paymentMethod.name,
        amount: Number(payment.amount),
        installments: payment.installments,
      })));
    });
  }, [activeProfile?.empresaId, draftLoaded]);

  // Product Search
  const handleSearchProduct = async (autoSelectSingle = true) => {
    const query = productQuery.trim();
    if (!activeProfile?.empresaId || !query) return;
    setIsSearchingProduct(true);
    setSearchError("");
    setSearchSuccess("");
    const res = await searchVariantsAction(activeProfile.empresaId, query);
    setIsSearchingProduct(false);
    if (res.success) {
      const variants = res.variants || [];
      if (variants.length === 1 && autoSelectSingle) {
        const variant = variants[0];
        const stock = Number(variant.availableStock);
        const allowNegativeStock = settings?.allowNegativeStock ?? false;
        
        if (stock <= 0 && !allowNegativeStock) {
          setSearchError("Produto sem estoque.");
          return;
        }
        
        handleSelectVariant(variant);
      } else if (variants.length > 1) {
        setSearchResults(variants);
        setSearchError("");
      } else {
        setSearchResults([]);
        setSearchError("Produto não encontrado.");
      }
    } else {
      setSearchError("Erro ao buscar: " + res.error);
    }
  };

  useEffect(() => {
    const query = productQuery.trim();
    const companyId = activeProfile?.empresaId;
    if (!companyId || query.length < 2) {
      setSearchResults([]);
      setIsSearchingProduct(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingProduct(true);
      const result = await searchVariantsAction(companyId, query);
      if (cancelled) return;
      setIsSearchingProduct(false);
      if (result.success) {
        setSearchResults(result.variants || []);
        setSearchError((result.variants || []).length === 0 ? "Produto não encontrado." : "");
      } else {
        setSearchResults([]);
        setSearchError(result.error || "Não foi possível buscar produtos.");
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeProfile?.empresaId, productQuery]);

  const handleSelectVariant = (variant: any) => {
    addToCart(variant);
    setProductQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchSuccess(`Adicionado: ${variant.product.name} - ${variant.name}`);
    setTimeout(() => setSearchSuccess(""), 3000);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSearchCustomer = async () => {
    const query = customerQuery.trim();
    if (!activeProfile?.empresaId || !query) return;
    setIsSearchingCustomer(true);
    const res = await searchCustomersAction(activeProfile.empresaId, customerQuery);
    setIsSearchingCustomer(false);
    if (res.success) {
      const customers = res.customers || [];
      setCustomerResults(customers);
      if (customers.length === 0) {
        const digits = query.replace(/\D/g, "");
        setQuickCustomerPhone(digits.length >= 8 ? query : "");
        setQuickCustomerName(digits.length >= 8 ? "" : query);
        setQuickChildren([{ name: "", age: "" }]);
        setQuickCustomerError("");
        setShowQuickCustomer(true);
      }
    }
  };

  const handleQuickCustomerCreate = async () => {
    setQuickCustomerError("");
    const children = quickChildren.map(child => ({
      name: child.name.trim(),
      age: child.age === "" ? Number.NaN : Number(child.age),
    }));
    setIsCreatingCustomer(true);
    const result = await createQuickCustomerAction({
      name: quickCustomerName.trim(),
      phone: quickCustomerPhone.trim(),
      children,
    });
    setIsCreatingCustomer(false);
    if (!result.success || !result.customer) {
      setQuickCustomerError(result.error || "Não foi possível cadastrar o cliente.");
      return;
    }
    setSelectedCustomer(result.customer);
    setCustomerResults([]);
    setCustomerQuery("");
    setShowQuickCustomer(false);
  };

  const addToCart = (variant: any) => {
    const stock = Number(variant.availableStock);
    const allowNegativeStock = settings?.allowNegativeStock ?? false;

    if (stock <= 0 && !allowNegativeStock) {
      alert("Estoque insuficiente!");
      return;
    }
    setCartItems(prev => {
      const existing = prev.find(i => i.variantId === variant.id);
      if (existing) {
        if (!allowNegativeStock && existing.quantity + 1 > stock) {
          alert("Estoque insuficiente para adicionar mais uma unidade.");
          return prev;
        }
        return prev.map(i => i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        variantId: variant.id,
        productNameSnapshot: variant.product?.name ?? "Produto sem nome",
        variantNameSnapshot: variant.name ?? "",
        skuSnapshot: variant.sku ?? "",
        barcodeSnapshot: variant.barcode ?? "",
        quantity: 1,
        unitPrice: Number(variant.salePrice),
        discountType: "AMOUNT",
        discountValue: 0,
        discount: 0,
        costPriceAtSale: Number(variant.costPrice || 0),
        salePriceAtSale: Number(variant.salePrice),
        marginAtSale: variant.costPrice ? ((Number(variant.salePrice) - Number(variant.costPrice)) / Number(variant.salePrice)) * 100 : 100,
        availableStock: stock
      }];
    });
    setSearchResults([]);
    setProductQuery("");
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCartItems(prev => prev.map(i => {
      if (i.variantId === variantId) {
        const newQ = i.quantity + delta;
        if (newQ > i.availableStock) {
          alert("Estoque insuficiente!");
          return i;
        }
        if (newQ <= 0) return i;
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const removeItem = (variantId: string) => {
    setCartItems(prev => prev.filter(i => i.variantId !== variantId));
  };

  const updateItemDiscountType = (variantId: string, type: "PERCENTAGE" | "AMOUNT") => {
    setCartItems(prev => prev.map(i => {
      if (i.variantId === variantId) {
        const val = i.discountValue;
        const discountAmount = type === "PERCENTAGE" ? (val / 100) * i.unitPrice : val;
        return { ...i, discountType: type, discount: discountAmount };
      }
      return i;
    }));
  };

  const updateItemDiscount = (variantId: string, val: string) => {
    const numVal = Number(val);
    setCartItems(prev => prev.map(i => {
      if (i.variantId === variantId) {
        const discountAmount = i.discountType === "PERCENTAGE" ? (numVal / 100) * i.unitPrice : numVal;
        return { ...i, discountValue: numVal, discount: discountAmount };
      }
      return i;
    }));
  };

  // Math
  const subtotal = cartItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  const itemsDiscount = cartItems.reduce((acc, i) => acc + (i.discount * i.quantity), 0);
  
  const subtotalAfterItems = subtotal - itemsDiscount;
  const globalDiscount = globalDiscountType === "PERCENTAGE" 
    ? (globalDiscountValue / 100) * subtotalAfterItems 
    : globalDiscountValue;

  const total = subtotalAfterItems - globalDiscount;
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingToPay = total - totalPaid;

  const addPayment = () => {
    if (!selectedPaymentMethod) return;
    const amount = Number(paymentAmount);
    if (amount <= 0) return;

    const pm = paymentMethods.find(m => m.id === selectedPaymentMethod);
    if (!pm) return;

    if (pm.type === "CUSTOMER_WALLET") {
      if (!selectedCustomer) {
        alert("Selecione o cliente para usar a carteira digital.");
        return;
      }
      if (settings && !settings.enableCustomerWallet) {
        alert("Carteira digital do cliente desativada nas configurações operacionais.");
        return;
      }
      const balance = Number(selectedCustomer.wallet?.balance || 0);
      if (balance < amount) {
        alert(`Saldo insuficiente na carteira (Saldo: R$ ${balance.toFixed(2)}).`);
        return;
      }

      // Validar saldo parcial
      if (settings && !settings.allowPartialWalletUsage) {
        const requiredAmount = Math.min(balance, remainingToPay);
        if (Math.abs(amount - requiredAmount) > 0.01) {
          alert(`Uso de saldo parcial desativado. Você deve utilizar o saldo integral (R$ ${requiredAmount.toFixed(2)}).`);
          return;
        }
      }
    }

    setPayments(prev => [...prev, {
      paymentMethodId: pm.id,
      name: pm.name,
      amount,
      installments: paymentInstallments
    }]);
    setPaymentAmount("");
    setSelectedPaymentMethod("");
    setPaymentInstallments(1);
  };

  const removePayment = (idx: number) => {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveDraft = async () => {
    if (cartItems.length === 0) return alert('Adicione ao menos um produto antes de guardar a venda.');
    if (!selectedSeller) return alert('Selecione um vendedor antes de guardar a venda.');
    setIsSavingDraft(true);
    const result = await saveDraftSaleAction({
      draftId: draftId || undefined,
      sellerId: selectedSeller,
      customerId: selectedCustomer?.id,
      globalDiscountType,
      globalDiscountValue,
      items: cartItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        discountType: item.discountType,
        discountValue: item.discountValue,
      })),
      payments: payments.map(payment => ({
        paymentMethodId: payment.paymentMethodId,
        amount: payment.amount,
        installments: payment.installments,
      })),
    });
    setIsSavingDraft(false);
    if (!result.success || !result.draft) return alert(result.error || 'Não foi possível guardar a venda.');
    setDraftId(result.draft.id);
    alert('Venda guardada com sucesso. Você poderá continuá-la pela lista de vendas.');
    router.push('/comercial/vendas');
  };

  const handleFinalize = async (pin?: string, reason?: string) => {
    if (cartItems.length === 0) return alert("Carrinho vazio!");
    if (!selectedSeller) return alert("Selecione um vendedor!");
    
    // Check if customer is required by operational settings
    const blockNãoCustomer = settings && (!settings.allowSaleWithoutCustomer || settings.requireCustomerOnSale);
    if (blockNãoCustomer && !selectedCustomer) {
      return alert("Operação não permitida: É obrigatório identificar o cliente para fechar a venda.");
    }

    if (totalPaid < total - 0.01) return alert("O valor pago não cobre o total da venda!");
    if (!activeProfile?.empresaId) return;

    setLoading(true);
    setPinError("");
    const res = await createSaleAction({
      draftId: draftId || undefined,
      companyId: activeProfile.empresaId,
      sellerId: selectedSeller,
      customerId: selectedCustomer?.id,
      customerNameSnapshot: selectedCustomer?.name,
      subtotal,
      discountAmount: itemsDiscount + globalDiscount,
      globalDiscountType,
      globalDiscountValue,
      totalAmount: total,
      items: cartItems.map(i => ({
        ...i,
        totalPrice: (i.unitPrice - i.discount) * i.quantity
      })),
      payments: payments.map(p => ({
        paymentMethodId: p.paymentMethodId,
        amount: p.amount,
        installments: p.installments
      })),
      authReason: reason,
      authorizationId: pin
    });

    setLoading(false);
    if (res.success) {
      alert("Venda finalizada com sucesso!");
      // Reset PDV
      setCartItems([]);
      setPayments([]);
      setSelectedCustomer(null);
      setGlobalDiscountValue(0);
      setShowPinModal(false);
      setAuthPin("");
      setAuthReason("");
      router.push(`/comercial/vendas/${res.sale!.id}`);
    } else {
      if (res.requireAuthorization) {
        setAuthPin(res.authorizationId);
        setShowPinModal(true);
      } else {
        alert("Erro ao finalizar venda:\n" + res.error);
      }
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="h-[calc(100vh-6rem)] overflow-hidden flex flex-col p-4 bg-slate-50 gap-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-md border shadow-sm shrink-0">
        <h1 className="text-xl font-bold text-slate-800">{draftId ? 'PDV / Continuar venda guardada' : 'PDV / Frente de Caixa'}</h1>
        <div className="flex items-center gap-4">
          <select 
            className="border rounded px-2 py-1 text-sm bg-slate-50"
            value={selectedSeller}
            onChange={e => setSelectedSeller(e.target.value)}
          >
            <option value="">Selecione Vendedor...</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Link href="/comercial/vendas"><Button variant="outline" size="sm">Voltar</Button></Link>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Esquerda: Produtos e Carrinho */}
        <div className="flex-[2] flex flex-col gap-4 overflow-hidden">
          {/* Busca Produto */}
          <Card className="shrink-0">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <Input 
                  ref={inputRef}
                  placeholder="Código de barras, SKU ou Nome do Produto..." 
                  value={productQuery}
                  onChange={e => {
                    setProductQuery(e.target.value);
                    setSearchError("");
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleSearchProduct()}
                  role="combobox"
                  aria-expanded={searchResults.length > 0}
                  aria-controls="product-search-results"
                  autoFocus
                />
                <Button onClick={() => handleSearchProduct()} disabled={isSearchingProduct} aria-label="Buscar produto">
                  {isSearchingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {searchError && <p className="text-sm text-red-500 font-medium">{searchError}</p>}
              {searchSuccess && <p className="text-sm text-green-600 font-medium">{searchSuccess}</p>}
            </CardContent>
          </Card>

          {/* Resultados Busca Produto */}
          {searchResults.length > 0 && (
            <Card id="product-search-results" className="shrink-0 max-h-48 overflow-y-auto">
              <CardContent className="p-2 divide-y" role="listbox" aria-label="Produtos encontrados">
                {searchResults.map(v => (
                  <div key={v.id} className="flex justify-between items-center p-2 hover:bg-slate-50" role="option" aria-selected="false">
                    <div>
                      <p className="font-bold text-sm">{v.product.name} - {v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {v.sku} | Código Interno: {v.product.internalCode || '-'} | Barcode: {v.barcode || '-'} | Estoque: {v.availableStock}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-green-600">{formatCurrency(Number(v.salePrice))}</p>
                      <Button size="sm" onClick={() => handleSelectVariant(v)}>Adicionar</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Carrinho */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 shrink-0"><CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Carrinho de Compras ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} itens)</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-center w-10">#</th>
                    <th className="p-2 text-left">Produto</th>
                    <th className="p-2 text-center w-24">Qtd</th>
                    <th className="p-2 text-right">Preço</th>
                    <th className="p-2 text-right w-24">Desc/Un</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cartItems.map((item, index) => (
                    <tr key={item.variantId} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-semibold text-slate-500">{index + 1}</td>
                      <td className="p-2">
                        <p className="font-bold">{item.productNameSnapshot}</p>
                        <p className="text-xs text-muted-foreground">{item.variantNameSnapshot} (SKU: {item.skuSnapshot})</p>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => updateQuantity(item.variantId, -1)} className="w-6 h-6 bg-slate-200 rounded font-bold hover:bg-slate-300">-</button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.variantId, 1)} className="w-6 h-6 bg-slate-200 rounded font-bold hover:bg-slate-300">+</button>
                        </div>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <select 
                            className="h-7 text-xs border rounded bg-slate-50 px-1"
                            value={item.discountType}
                            onChange={(e) => updateItemDiscountType(item.variantId, e.target.value as any)}
                          >
                            <option value="AMOUNT">R$</option>
                            <option value="PERCENTAGE">%</option>
                          </select>
                          <Input 
                            type="number" 
                            min={0} max={item.discountType === "PERCENTAGE" ? 100 : item.unitPrice} 
                            className="h-7 text-right text-xs w-16" 
                            value={item.discountValue}
                            onChange={(e) => updateItemDiscount(item.variantId, e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="p-2 text-right font-bold">{formatCurrency((item.unitPrice - item.discount) * item.quantity)}</td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeItem(item.variantId)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {cartItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">O carrinho está vazio.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Direita: Cliente, Resumo, Pagamentos */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          
          {/* Cliente */}
          <Card className="shrink-0">
            <CardHeader className="py-3"><CardTitle className="text-md flex items-center gap-2"><User className="w-4 h-4"/> Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {selectedCustomer ? (
                <div className="bg-slate-100 p-3 rounded-md flex justify-between items-center border">
                  <div>
                    <p className="font-bold">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.email || selectedCustomer.phone || '-'}</p>
                    {selectedCustomer.wallet && (
                      <p className="text-xs font-bold text-indigo-600 mt-1">Saldo Carteira: {formatCurrency(Number(selectedCustomer.wallet.balance))}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Buscar cliente por nome ou telefone..."
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchCustomer()}
                  />
                  <Button variant="outline" onClick={handleSearchCustomer} disabled={isSearchingCustomer} aria-label="Buscar cliente">
                    {isSearchingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              )}
              {customerResults.length > 0 && !selectedCustomer && (
                <div className="border rounded-md divide-y max-h-32 overflow-y-auto bg-white">
                  {customerResults.map(c => (
                    <div key={c.id} className="p-2 flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedCustomer(c); setCustomerResults([]); setCustomerQuery(""); }}>
                      <span>{c.name}</span>
                      <Button size="sm" variant="ghost">Selecionar</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo e Pagamentos */}
          <Card className="flex-1 flex flex-col bg-slate-800 text-white shadow-xl">
            <CardContent className="p-5 flex-1 flex flex-col gap-4">
              
              <div className="space-y-1 text-sm border-b border-slate-700 pb-3">
                <div className="flex justify-between"><span>Subtotal:</span> <span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-red-300"><span>Descontos Itens:</span> <span>- {formatCurrency(itemsDiscount)}</span></div>
                <div className="flex justify-between items-center text-red-300">
                  <span>Desconto Global:</span> 
                  <div className="flex gap-1 w-32">
                    <select 
                      className="h-7 text-xs border-slate-600 bg-slate-700 rounded px-1 text-white"
                      value={globalDiscountType}
                      onChange={(e) => setGlobalDiscountType(e.target.value as any)}
                    >
                      <option value="AMOUNT">R$</option>
                      <option value="PERCENTAGE">%</option>
                    </select>
                    <Input 
                      type="number" 
                      className="h-7 text-right bg-slate-700 border-slate-600 text-white w-full" 
                      value={globalDiscountValue}
                      onChange={e => setGlobalDiscountValue(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <span className="text-slate-300">Total a Pagar</span>
                <span className="text-4xl font-bold text-green-400">{formatCurrency(total)}</span>
              </div>

              {/* Múltiplos Pagamentos */}
              <div className="bg-slate-700 rounded-lg p-3 space-y-3 mt-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2"><CreditCard className="w-4 h-4"/> Pagamentos</h3>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded">Restante: <span className="font-bold text-red-400">{formatCurrency(Math.max(0, remainingToPay))}</span></span>
                </div>
                
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <select 
                    className="flex-1 min-w-[120px] h-9 rounded bg-slate-800 border-slate-600 text-sm px-2 text-white"
                    value={selectedPaymentMethod}
                    onChange={e => {
                      setSelectedPaymentMethod(e.target.value);
                      if (remainingToPay > 0) setPaymentAmount(remainingToPay.toFixed(2));
                      setPaymentInstallments(1);
                    }}
                  >
                    <option value="">Selecione o Meio...</option>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>

                  {(() => {
                    const pm = paymentMethods.find(m => m.id === selectedPaymentMethod);
                    const maxInst = settings?.maxInstallments || 1;
                    if (pm?.allowsInstallments && maxInst > 1) {
                      return (
                        <select
                          className="w-20 h-9 rounded bg-slate-800 border-slate-600 text-sm px-2 text-white"
                          value={paymentInstallments}
                          onChange={e => setPaymentInstallments(Number(e.target.value))}
                        >
                          {Array.from({ length: maxInst }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}x</option>
                          ))}
                        </select>
                      );
                    }
                    return null;
                  })()}

                  <Input 
                    type="number" 
                    placeholder="R$ 0,00"
                    className="w-24 h-9 bg-slate-800 border-slate-600 text-right text-white"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                  />
                  <Button onClick={addPayment} className="h-9 px-3 bg-green-600 hover:bg-green-500"><Plus className="w-4 h-4"/></Button>
                </div>
                {paymentMethodsError ? <p className="text-xs font-medium text-red-300">{paymentMethodsError}</p> : null}
                {!paymentMethodsError && paymentMethods.length === 0 ? (
                  <p className="text-xs text-amber-200">Nenhuma forma de pagamento ativa foi cadastrada.</p>
                ) : null}

                {(() => {
                  const pm = paymentMethods.find(m => m.id === selectedPaymentMethod);
                  if (pm?.type === "CUSTOMER_WALLET" && selectedCustomer) {
                    const walletBalance = Number(selectedCustomer.wallet?.balance || 0);
                    const maxUse = Math.min(walletBalance, remainingToPay);
                    return (
                      <div className="w-full flex justify-between items-center gap-2 mt-2 bg-slate-800 p-2 rounded border border-slate-700 text-xs">
                        <span className="text-slate-300 font-semibold">Disponível: {formatCurrency(walletBalance)}</span>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-500 h-7 text-[10px]"
                            onClick={() => {
                              setPaymentAmount(maxUse.toFixed(2));
                            }}
                          >
                            Usar Saldo Total
                          </Button>
                          {settings?.allowPartialWalletUsage !== false && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] text-white border-slate-600 hover:bg-slate-700"
                              onClick={() => {
                                setPaymentAmount((maxUse / 2).toFixed(2));
                              }}
                            >
                              Usar Parcial (50%)
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-2 mt-2 max-h-24 overflow-y-auto">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-800 p-2 rounded text-sm">
                      <span>{p.name} {p.installments > 1 ? `(${p.installments}x)` : ''}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{formatCurrency(p.amount)}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:bg-slate-700" onClick={() => removePayment(idx)}><X className="w-4 h-4"/></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-slate-600">
                  <span>Total Pago:</span>
                  <span className="text-green-400">{formatCurrency(totalPaid)}</span>
                </div>
              </div>

            </CardContent>
            
            <div className="grid grid-cols-[auto_1fr] gap-2 p-4 bg-slate-900 rounded-b-xl shrink-0">
              <Button
                variant="outline"
                className="h-16 border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white"
                disabled={isSavingDraft || loading || cartItems.length === 0}
                onClick={handleSaveDraft}
              >
                {isSavingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar venda
              </Button>
              <Button className="h-16 text-lg" size="lg" disabled={loading || isSavingDraft} onClick={() => handleFinalize()}>
                {loading ? "Processando..." : "FINALIZAR VENDA"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={showQuickCustomer} onOpenChange={setShowQuickCustomer}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Cadastro rápido de cliente</DialogTitle>
            <DialogDescription>
              Nenhum cadastro foi encontrado. Informe os dados abaixo para criar e selecionar o cliente nesta venda.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="quick-customer-name">Nome do cliente</Label>
                <Input id="quick-customer-name" value={quickCustomerName} onChange={event => setQuickCustomerName(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="quick-customer-phone">Telefone</Label>
                <Input id="quick-customer-phone" inputMode="tel" value={quickCustomerPhone} onChange={event => setQuickCustomerPhone(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Crianças</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuickChildren(children => [...children, { name: "", age: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar criança
                </Button>
              </div>
              {quickChildren.map((child, index) => (
                <div key={index} className="grid grid-cols-[1fr_100px_36px] items-end gap-2 rounded-lg border p-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`quick-child-name-${index}`}>Nome da criança</Label>
                    <Input
                      id={`quick-child-name-${index}`}
                      value={child.name}
                      onChange={event => setQuickChildren(children => children.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`quick-child-age-${index}`}>Idade</Label>
                    <Input
                      id={`quick-child-age-${index}`}
                      type="number"
                      min="0"
                      max="25"
                      value={child.age}
                      onChange={event => setQuickChildren(children => children.map((item, itemIndex) => itemIndex === index ? { ...item, age: event.target.value } : item))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-red-500"
                    disabled={quickChildren.length === 1}
                    onClick={() => setQuickChildren(children => children.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remover criança ${index + 1}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {quickCustomerError ? <p className="text-sm font-medium text-red-600">{quickCustomerError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(false)}>Cancelar</Button>
              <Button type="button" onClick={handleQuickCustomerCreate} disabled={isCreatingCustomer}>
                {isCreatingCustomer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Cadastrar e selecionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showPinModal && (
        <AuthorizationDialog
          open={showPinModal}
          onOpenChange={setShowPinModal}
          authorizationId={authPin} // Nãote: state variable is named authPin, but it holds the authorizationId
          authorizationType="DISCOUNT"
          title="Desconto acima do limite"
          description="O desconto aplicado excede o seu limite de alçada. Solicite a aprovação gerencial."
          amount={globalDiscount + itemsDiscount}
          percentage={subtotal > 0 ? ((globalDiscount + itemsDiscount) / subtotal) * 100 : 0}
          onAuthorized={(authRecord) => {
            handleFinalize(authRecord.id);
          }}
          onRejected={() => {
            alert('A autorização de desconto foi rejeitada.');
            setGlobalDiscountValue(0);
            setShowPinModal(false);
          }}
        />
      )}
    </div>
  );
}
