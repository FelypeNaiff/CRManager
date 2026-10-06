// We will generate the pdv component content and save it to src/app/(dashboard)/pdv/page-v2.tsx
const fs = require('fs');

const code = `
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ShoppingCart, User, CreditCard, X, Loader2, UserPlus, Minus, Save, CheckCircle, Printer, FileText } from "lucide-react";
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
  
  const productInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

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

  // --- NEW UI STATES ---
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [finishedSaleId, setFinishedSaleId] = useState<string | null>(null);

  const [stagedVariant, setStagedVariant] = useState<any>(null);
  const [stagedQuantity, setStagedQuantity] = useState<number>(1);

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
  const handleSearchProduct = async () => {
    const query = productQuery.trim();
    if (!activeProfile?.empresaId || !query) return;
    setIsSearchingProduct(true);
    setSearchError("");
    setSearchSuccess("");
    const res = await searchVariantsAction(activeProfile.empresaId, query);
    setIsSearchingProduct(false);
    if (res.success) {
      const variants = res.variants || [];
      if (variants.length > 0) {
        setSearchResults(variants);
        setSearchError("");
        if (variants.length === 1) {
          // If only 1, auto stage it
          handleStageVariant(variants[0]);
        }
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

  const handleStageVariant = (variant: any) => {
    const stock = Number(variant.availableStock);
    const allowNegativeStock = settings?.allowNegativeStock ?? false;
    if (stock <= 0 && !allowNegativeStock) {
      setSearchError("Produto sem estoque.");
      return;
    }
    setStagedVariant(variant);
    setStagedQuantity(1);
    setSearchError("");
    setSearchResults([]);
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 50);
  };

  const handleAddStagedToCart = () => {
    if (!stagedVariant || stagedQuantity <= 0) return;
    
    setCartItems(prev => {
      const existing = prev.find(item => item.variantId === stagedVariant.id);
      if (existing) {
        return prev.map(item => item.variantId === stagedVariant.id ? { ...item, quantity: item.quantity + stagedQuantity } : item);
      }
      return [...prev, {
        variantId: stagedVariant.id,
        productNameSnapshot: stagedVariant.product.name,
        variantNameSnapshot: stagedVariant.name,
        skuSnapshot: stagedVariant.sku || '',
        barcodeSnapshot: stagedVariant.barcode || '',
        quantity: stagedQuantity,
        unitPrice: Number(stagedVariant.salePrice),
        discountType: "AMOUNT",
        discountValue: 0,
        discount: 0,
        costPriceAtSale: Number(stagedVariant.costPrice),
        salePriceAtSale: Number(stagedVariant.salePrice),
        marginAtSale: Number(stagedVariant.salePrice) - Number(stagedVariant.costPrice),
        availableStock: Number(stagedVariant.availableStock),
      }];
    });

    setSearchSuccess(\`Adicionado: \${stagedVariant.product.name} - \${stagedVariant.name}\`);
    setTimeout(() => setSearchSuccess(""), 3000);
    
    setStagedVariant(null);
    setStagedQuantity(1);
    setProductQuery("");
    setTimeout(() => productInputRef.current?.focus(), 50);
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
    setShowQuickCustomer(false);
    setIsCustomerModalOpen(false);
    setCustomerQuery("");
    setCustomerResults([]);
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const updateItemDiscountType = (variantId: string, type: "PERCENTAGE" | "AMOUNT") => {
    setCartItems(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const discount = type === "PERCENTAGE" 
          ? (item.unitPrice * (item.discountValue || 0)) / 100 
          : (item.discountValue || 0);
        return { ...item, discountType: type, discount };
      }
      return item;
    }));
  };

  const updateItemDiscount = (variantId: string, valueStr: string) => {
    const value = Number(valueStr);
    if (isNaN(value) || value < 0) return;
    setCartItems(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const maxVal = item.discountType === "PERCENTAGE" ? 100 : item.unitPrice;
        const finalVal = Math.min(maxVal, value);
        const discount = item.discountType === "PERCENTAGE" 
          ? (item.unitPrice * finalVal) / 100 
          : finalVal;
        return { ...item, discountValue: finalVal, discount };
      }
      return item;
    }));
  };

  const removeItem = (variantId: string) => {
    setCartItems(prev => prev.filter(item => item.variantId !== variantId));
  };

  const addPayment = () => {
    if (!selectedPaymentMethod) return alert("Selecione a forma de pagamento!");
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) return alert("Valor inválido!");
    
    const pm = paymentMethods.find(m => m.id === selectedPaymentMethod);
    if (!pm) return;

    if (pm.type === "CUSTOMER_WALLET") {
      const walletBalance = Number(selectedCustomer?.wallet?.balance || 0);
      if (amt > walletBalance) {
        return alert(\`O valor excede o saldo disponível na carteira (\${walletBalance}).\`);
      }
    }

    setPayments(prev => [...prev, {
      paymentMethodId: selectedPaymentMethod,
      name: pm.name,
      amount: amt,
      installments: paymentInstallments
    }]);
    
    setPaymentAmount("");
    setSelectedPaymentMethod("");
    setPaymentInstallments(1);
  };

  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const itemsDiscount = cartItems.reduce((acc, item) => acc + (item.discount * item.quantity), 0);
  const globalDiscount = globalDiscountType === "PERCENTAGE" 
    ? ((subtotal - itemsDiscount) * globalDiscountValue) / 100 
    : globalDiscountValue;
  const total = Math.max(0, subtotal - itemsDiscount - globalDiscount);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingToPay = total - totalPaid;

  const handleSaveDraft = async () => {
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
    
    const blockNãoCustomer = settings && (!settings.allowSaleWithoutCustomer || settings.requireCustomerOnSale);
    if (blockNãoCustomer && !selectedCustomer) {
      return alert("Operação não permitida: É obrigatório identificar o cliente para fechar a venda.");
    }

    if (totalPaid < total - 0.01) return alert("O valor pago não cobre o total da venda!");
    if (!activeProfile?.empresaId) return;

    setLoading(true);
    setPinError("");
    const res = await createSaleAction({
      channel: new URLSearchParams(window.location.search).get('channel') === 'PRODUCT' ? "PRODUCT" : "COUNTER",
      freightAmount: 0,
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
      setFinishedSaleId(res.sale!.id);
      setIsPaymentModalOpen(false);
      setIsSuccessModalOpen(true);
      // Reset PDV
      setCartItems([]);
      setPayments([]);
      setSelectedCustomer(null);
      setGlobalDiscountValue(0);
      setShowPinModal(false);
      setAuthPin("");
      setAuthReason("");
    } else {
      if (res.requireAuthorization) {
        setAuthPin(res.authorizationId);
        setShowPinModal(true);
      } else {
        alert("Erro ao finalizar venda:\\n" + res.error);
      }
    }
  };

  // Keyboard Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "F2") {
      e.preventDefault();
      productInputRef.current?.focus();
    } else if (e.key === "F4") {
      e.preventDefault();
      handleAddStagedToCart();
    } else if (e.key === "F6") {
      e.preventDefault();
      if (cartItems.length > 0) {
        setIsPaymentModalOpen(true);
      }
    } else if (e.shiftKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setIsCustomerModalOpen(true);
    } else if (e.shiftKey && e.key.toLowerCase() === "v") {
      e.preventDefault();
      setIsSellerModalOpen(true);
    }
  }, [stagedVariant, stagedQuantity, cartItems]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="h-[calc(100vh-6rem)] overflow-hidden flex flex-col p-4 bg-slate-50 gap-4 font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="flex justify-between items-center shrink-0 border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{draftId ? 'PDV / Continuar venda' : 'PDV / Frente de Caixa'}</h1>
        
        {/* Top Cards: Client & Seller */}
        <div className="flex items-center gap-4">
          {/* Vendedor */}
          <button 
            onClick={() => setIsSellerModalOpen(true)}
            className="flex flex-col items-start px-4 py-2 border rounded-md bg-white shadow-sm hover:border-slate-400 transition min-w-[160px]"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <User className="w-3 h-3" /> 
              <span>Vendedor <kbd className="bg-slate-100 rounded px-1 text-[10px] ml-1">Shift+V</kbd></span>
            </div>
            <span className="font-semibold text-sm truncate w-full text-left">
              {selectedSeller ? sellers.find(s => s.id === selectedSeller)?.name || "Selecionado" : "Selecionar"}
            </span>
          </button>

          {/* Cliente */}
          <button 
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex flex-col items-start px-4 py-2 border rounded-md bg-white shadow-sm hover:border-slate-400 transition min-w-[160px]"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <User className="w-3 h-3" /> 
              <span>Cliente <kbd className="bg-slate-100 rounded px-1 text-[10px] ml-1">Shift+C</kbd></span>
            </div>
            <span className="font-semibold text-sm truncate w-full text-left">
              {selectedCustomer ? selectedCustomer.name : "Consumidor Final"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        
        {/* LEFT COLUMN: Launch Product */}
        <div className="flex-[2] flex flex-col gap-4 overflow-hidden">
          <Card className="flex flex-col overflow-visible border-slate-200 shadow-sm">
            <CardHeader className="py-4 bg-slate-100/50 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Localize um produto ou serviço</span>
                <span className="text-xs text-slate-500 font-normal">Digite o código ou nome, ou passe o leitor.</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <Input 
                      ref={productInputRef}
                      placeholder="|||| Digite o código ou o nome" 
                      className="pl-10 h-10 text-md bg-slate-50 border-slate-300 focus:bg-white"
                      value={productQuery}
                      onChange={e => setProductQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSearchProduct();
                      }}
                    />
                  </div>
                  <div className="shrink-0 flex items-center border rounded-md px-3 bg-slate-100 text-xs font-semibold text-slate-500">
                    F2
                  </div>
                </div>

                {isSearchingProduct && <div className="absolute top-12 left-0 text-sm text-slate-500">Buscando...</div>}
                {searchError && <div className="absolute top-12 left-0 text-sm text-red-500">{searchError}</div>}
                
                {/* Search Results Dropdown */}
                {searchResults.length > 1 && !stagedVariant && (
                  <div className="absolute top-12 left-0 right-0 z-50 bg-white border border-slate-200 shadow-lg rounded-md max-h-64 overflow-y-auto">
                    {searchResults.map(variant => (
                      <div 
                        key={variant.id} 
                        className="p-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                        onClick={() => handleStageVariant(variant)}
                      >
                        <div>
                          <p className="font-semibold">{variant.product.name}</p>
                          <p className="text-xs text-slate-500">{variant.name} - SKU: {variant.sku || '-'}</p>
                        </div>
                        <p className="font-bold text-green-600">{formatCurrency(Number(variant.salePrice))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {stagedVariant && (
                <div className="grid grid-cols-[160px_1fr] gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <div className="w-40 h-40 bg-slate-200 rounded-md flex items-center justify-center text-slate-400">
                    {/* Placeholder image */}
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 border-2 border-slate-400 rounded-sm" />
                      <span className="text-xs">Sem foto</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg">{stagedVariant.product.name}</h3>
                      <p className="text-sm text-slate-500">{stagedVariant.name} (SKU: {stagedVariant.sku})</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500">Valor unitário</Label>
                        <p className="font-semibold text-lg">{formatCurrency(Number(stagedVariant.salePrice))}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Quantidade</Label>
                        <Input 
                          ref={quantityInputRef}
                          type="number" 
                          min={1} 
                          value={stagedQuantity} 
                          onChange={(e) => setStagedQuantity(Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddStagedToCart();
                          }}
                          className="h-10 text-lg font-bold"
                        />
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white flex justify-between px-4 mt-2" 
                      onClick={handleAddStagedToCart}
                    >
                      <span className="flex items-center gap-2"><Plus className="w-5 h-5"/> Adicionar produto</span>
                      <kbd className="bg-slate-700 rounded px-2 py-0.5 text-xs">F4</kbd>
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Cart */}
        <div className="flex-[1] flex flex-col gap-4 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="py-4 bg-slate-100/50 border-b shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4"/> 
                <span>Itens da Venda</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium">Nenhum item na venda</p>
                  <p className="text-sm">Busque um produto ao lado para começar.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {cartItems.map((item, index) => (
                    <div key={item.variantId} className="p-3 hover:bg-slate-50 flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-xs text-slate-400 mt-0.5">{item.quantity}x</span>
                          <div>
                            <p className="font-semibold text-sm leading-tight">{item.productNameSnapshot}</p>
                            <p className="text-xs text-slate-500">{item.variantNameSnapshot}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-sm">{formatCurrency((item.unitPrice - item.discount) * item.quantity)}</span>
                          <button onClick={() => removeItem(item.variantId)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            
            {/* Totals & F6 */}
            <div className="bg-slate-50 border-t p-4 shrink-0 space-y-4">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-500">Total do pedido</span>
                  <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 mt-1 w-fit">{cartItems.length} item(s)</span>
                </div>
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
              </div>
              
              <Button 
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg flex justify-between px-4"
                disabled={cartItems.length === 0}
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <span>Finalizar venda</span>
                <kbd className="bg-slate-700 rounded px-2 py-0.5 text-xs">F6</kbd>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* FOOTER SHORTCUTS */}
      <div className="shrink-0 flex gap-4 justify-center py-2 text-xs text-slate-500 bg-white border rounded-md shadow-sm">
        <span className="flex items-center gap-1"><kbd className="bg-slate-100 border px-1 rounded font-mono">F2</kbd> Nova busca</span>
        <span className="flex items-center gap-1"><kbd className="bg-slate-100 border px-1 rounded font-mono">F4</kbd> Adicionar produto</span>
        <span className="flex items-center gap-1"><kbd className="bg-slate-100 border px-1 rounded font-mono">F6</kbd> Finalizar venda</span>
        <span className="flex items-center gap-1"><kbd className="bg-slate-100 border px-1 rounded font-mono">Shift+C</kbd> Indicar cliente</span>
        <span className="flex items-center gap-1"><kbd className="bg-slate-100 border px-1 rounded font-mono">Shift+V</kbd> Indicar vendedor</span>
      </div>

      {/* --- MODALS --- */}

      {/* Vendedor Modal */}
      <Dialog open={isSellerModalOpen} onOpenChange={setIsSellerModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5"/> Indicar vendedor</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block text-xs text-slate-500">Vendedor</Label>
            <select 
              className="w-full border rounded-md p-2 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={selectedSeller}
              onChange={(e) => {
                setSelectedSeller(e.target.value);
                setIsSellerModalOpen(false);
              }}
              size={sellers.length > 5 ? 6 : sellers.length + 1}
            >
              <option value="" disabled>Selecione um vendedor...</option>
              {sellers.map(s => (
                <option key={s.id} value={s.id} className="p-2 hover:bg-slate-100 cursor-pointer">{s.name}</option>
              ))}
            </select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cliente Modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5"/> Indicar cliente</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="flex gap-2 relative">
              <Input 
                placeholder="Buscar por nome ou contato..."
                value={customerQuery}
                onChange={e => setCustomerQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchCustomer()}
              />
              <Button variant="outline" onClick={handleSearchCustomer} disabled={isSearchingCustomer}>
                {isSearchingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </Button>
              <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-semibold tracking-wide">NO NEEX É PELO CONTATO</span>
            </div>

            {customerResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto mt-4">
                {customerResults.map(c => (
                  <div key={c.id} className="p-3 flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50" 
                    onClick={() => { 
                      setSelectedCustomer(c); 
                      setCustomerResults([]); 
                      setCustomerQuery(""); 
                      setIsCustomerModalOpen(false);
                    }}>
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.phone || c.email}</p>
                    </div>
                    <Button size="sm" variant="ghost">Selecionar</Button>
                  </div>
                ))}
              </div>
            )}
            
            {selectedCustomer && (
              <div className="bg-slate-100 p-3 rounded-md flex justify-between items-center border mt-4">
                <div>
                  <p className="font-bold">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.phone || '-'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Customer Create Modal (Triggered when search yields 0) */}
      <Dialog open={showQuickCustomer} onOpenChange={setShowQuickCustomer}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Cadastro rápido de cliente</DialogTitle>
            <DialogDescription>
              Nenhum cadastro foi encontrado. Informe os dados abaixo para criar e selecionar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nome do cliente</Label>
                <Input value={quickCustomerName} onChange={e => setQuickCustomerName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Telefone</Label>
                <Input inputMode="tel" value={quickCustomerPhone} onChange={e => setQuickCustomerPhone(e.target.value)} />
              </div>
            </div>

            {quickCustomerError && <p className="text-sm text-red-600">{quickCustomerError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(false)}>Cancelar</Button>
              <Button type="button" onClick={handleQuickCustomerCreate} disabled={isCreatingCustomer}>
                {isCreatingCustomer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar e selecionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receber Modal (F6) */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-slate-50 gap-0">
          
          <div className="flex flex-col md:flex-row h-[70vh]">
            
            {/* Left Col: Setup Payment */}
            <div className="flex-1 border-r bg-white p-6 flex flex-col gap-6 overflow-y-auto">
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center justify-between text-2xl font-bold">
                  <span className="flex items-center gap-2"><CreditCard className="w-6 h-6"/> Receber</span>
                  <kbd className="bg-slate-100 border px-2 py-1 rounded text-sm text-slate-500 font-mono">F6</kbd>
                </DialogTitle>
                <DialogDescription>Escolha a forma, as parcelas e confirme o valor recebido.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-[2fr_1fr] gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Forma de pagamento</Label>
                  <select 
                    className="w-full h-10 border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    value={selectedPaymentMethod}
                    onChange={e => {
                      setSelectedPaymentMethod(e.target.value);
                      if (remainingToPay > 0) setPaymentAmount(remainingToPay.toFixed(2));
                      setPaymentInstallments(1);
                    }}
                  >
                    <option value="">Selecione...</option>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Parcelas</Label>
                  <select
                    className="w-full h-10 border rounded-md px-3 text-sm bg-white disabled:bg-slate-100"
                    value={paymentInstallments}
                    onChange={e => setPaymentInstallments(Number(e.target.value))}
                    disabled={!selectedPaymentMethod}
                  >
                    {(() => {
                      const pm = paymentMethods.find(m => m.id === selectedPaymentMethod);
                      const maxInst = (pm?.allowsInstallments ? settings?.maxInstallments : 1) || 1;
                      return Array.from({ length: maxInst }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_2fr_auto] gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Desconto Global</Label>
                  <div className="flex">
                    <select 
                      className="h-10 text-xs border rounded-l-md px-2 bg-slate-50"
                      value={globalDiscountType}
                      onChange={(e) => setGlobalDiscountType(e.target.value as any)}
                    >
                      <option value="AMOUNT">R$</option>
                      <option value="PERCENTAGE">%</option>
                    </select>
                    <Input 
                      type="number" 
                      className="h-10 text-right rounded-l-none" 
                      value={globalDiscountValue}
                      onChange={e => {
                        setGlobalDiscountValue(Number(e.target.value));
                        // Re-adjust payment amount to new remaining
                        setTimeout(() => {
                           const newRemaining = Math.max(0, subtotal - itemsDiscount - (globalDiscountType === "PERCENTAGE" ? ((subtotal - itemsDiscount) * Number(e.target.value)) / 100 : Number(e.target.value)) - totalPaid);
                           if (newRemaining > 0 && selectedPaymentMethod) setPaymentAmount(newRemaining.toFixed(2));
                        }, 50);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Valor recebido</Label>
                  <Input 
                    type="number" 
                    className="h-10 text-right text-lg font-bold" 
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={addPayment} 
                  className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold flex gap-2"
                >
                  <CheckCircle className="w-4 h-4"/> Confirmar
                </Button>
              </div>

              {/* Itens da Venda Review */}
              <div className="mt-4 border-t pt-4 flex-1 overflow-y-auto">
                <h4 className="text-sm font-bold flex items-center gap-2 mb-3"><ShoppingCart className="w-4 h-4 text-slate-400"/> Itens da venda</h4>
                <div className="space-y-2">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600">{item.quantity}x {item.productNameSnapshot} {item.variantNameSnapshot !== 'Único' ? \`(\${item.variantNameSnapshot})\` : ''}</span>
                      <span className="font-semibold">{formatCurrency((item.unitPrice - item.discount) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Col: Received Payments & Summary */}
            <div className="flex-[0.8] bg-slate-50 p-6 flex flex-col justify-between overflow-y-auto border-l">
              <div className="space-y-6">
                
                {/* Context badges */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-white border rounded p-2 text-xs">
                    <span className="text-slate-400 block mb-0.5">Cliente</span>
                    <span className="font-bold text-slate-700 truncate block">{selectedCustomer ? selectedCustomer.name : "Consumidor Final"}</span>
                  </div>
                  <div className="flex-1 bg-white border rounded p-2 text-xs">
                    <span className="text-slate-400 block mb-0.5">Vendedor</span>
                    <span className="font-bold text-slate-700 truncate block">{selectedSeller ? sellers.find(s=>s.id === selectedSeller)?.name : "-"}</span>
                  </div>
                </div>

                {/* Pagamentos Recebidos */}
                <div>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    <span className="text-green-600">$</span> Pagamentos recebidos
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">O que já foi confirmado nesta venda.</p>
                  
                  {payments.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-400 mt-8">
                      <span className="text-2xl mb-2 font-serif italic">$</span>
                      <p className="font-bold text-sm text-slate-600">Nenhum pagamento ainda</p>
                      <p className="text-xs mt-1">Escolha a forma ao lado e confirme o valor recebido.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-white border rounded p-2">
                      {payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded border text-sm">
                          <div>
                            <span className="font-semibold">{p.name}</span>
                            {p.installments > 1 && <span className="text-xs text-slate-500 ml-1">({p.installments}x)</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold">{formatCurrency(p.amount)}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50" onClick={() => removePayment(idx)}><X className="w-4 h-4"/></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Summary */}
              <div className="mt-6 pt-4 border-t space-y-4">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white border rounded p-2">
                    <span className="text-slate-400 block mb-1">Subtotal</span>
                    <span className="font-bold text-sm">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="bg-white border rounded p-2">
                    <span className="text-slate-400 block mb-1">Descontos</span>
                    <span className="font-bold text-sm text-red-500">{formatCurrency(itemsDiscount + globalDiscount)}</span>
                  </div>
                  <div className="bg-white border rounded p-2">
                    <span className="text-slate-400 block mb-1">Recebido</span>
                    <span className="font-bold text-sm text-green-600">{formatCurrency(totalPaid)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-end pb-2">
                  <span className="text-slate-500 font-semibold">{remainingToPay > 0 ? 'Faltam' : 'Troco'}</span>
                  <span className={\`text-3xl font-bold \${remainingToPay > 0 ? 'text-red-500' : 'text-slate-900'}\`}>
                    {formatCurrency(Math.abs(remainingToPay))}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setIsPaymentModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    className="flex-[2] h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold flex justify-between px-4"
                    disabled={loading || totalPaid < total - 0.01}
                    onClick={() => handleFinalize()}
                  >
                    <span>{loading ? "Finalizando..." : "Finalizar venda"}</span>
                    {!loading && <kbd className="bg-slate-700 rounded px-2 py-0.5 text-xs">F6</kbd>}
                  </Button>
                </div>
              </div>

            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={isSuccessModalOpen} onOpenChange={(open) => {
        if(!open) {
          setIsSuccessModalOpen(false);
          setFinishedSaleId(null);
        }
      }}>
        <DialogContent className="sm:max-w-md text-center flex flex-col items-center p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">Venda Finalizada!</DialogTitle>
            <DialogDescription className="text-center pt-2">
              A venda foi registrada com sucesso no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-3 w-full mt-6">
            <Button className="w-full h-12" onClick={() => { setIsSuccessModalOpen(false); setFinishedSaleId(null); }}>
              <Plus className="w-4 h-4 mr-2" /> Iniciar nova venda
            </Button>
            {finishedSaleId && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Button variant="outline" className="h-12 border-slate-300" onClick={() => window.open(\`/comercial/vendas/\${finishedSaleId}/recibo\`, '_blank')}>
                  <Printer className="w-4 h-4 mr-2" /> Imprimir cupom
                </Button>
                <Button variant="outline" className="h-12 border-slate-300">
                  <FileText className="w-4 h-4 mr-2" /> Emitir NFC-e
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showPinModal && (
        <AuthorizationDialog
          open={showPinModal}
          onOpenChange={setShowPinModal}
          authorizationId={authPin}
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
`;

fs.writeFileSync('src/app/(dashboard)/pdv/page-v2.tsx', code);
console.log('pdv-new created');
