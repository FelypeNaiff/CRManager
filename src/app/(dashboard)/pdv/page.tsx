"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { searchVariantsAction, searchCustomersAction } from "@/lib/sales/actions/search-sales-entities-action";
import { listSellersAction } from "@/lib/sales/actions/list-sellers-action";
import { listPaymentMethodsAction } from "@/lib/sales/actions/list-payment-methods-action";
import { createSaleAction } from "@/lib/sales/actions/create-sale-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, ShoppingCart, User, CreditCard, X } from "lucide-react";
import Link from "next/link";

export default function PDVPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();

  // Search
  const [productQuery, setProductQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [customerResults, setCustomerResults] = useState<any[]>([]);

  // Cart & Sale State
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedSeller, setSelectedSeller] = useState<string>("");
  const [sellers, setSellers] = useState<any[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);

  // Payments State
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  
  // New Payment Form
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  // Auth PIN Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [authPin, setAuthPin] = useState("");
  const [authReason, setAuthReason] = useState("");
  const [pinError, setPinError] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeProfile?.empresaId) {
      listSellersAction(activeProfile.empresaId).then(res => {
        if (res.success) setSellers(res.sellers || []);
        if (activeProfile.userId) setSelectedSeller(activeProfile.userId);
      });
      listPaymentMethodsAction(activeProfile.empresaId).then(res => {
        if (res.success) setPaymentMethods(res.paymentMethods || []);
      });
    }
  }, [activeProfile]);

  // Product Search
  const handleSearchProduct = async () => {
    if (!activeProfile?.empresaId || !productQuery) return;
    const res = await searchVariantsAction(activeProfile.empresaId, productQuery);
    if (res.success) setSearchResults(res.variants || []);
  };

  const handleSearchCustomer = async () => {
    if (!activeProfile?.empresaId || !customerQuery) return;
    const res = await searchCustomersAction(activeProfile.empresaId, customerQuery);
    if (res.success) setCustomerResults(res.customers || []);
  };

  const addToCart = (variant: any) => {
    if (Number(variant.availableStock) <= 0) {
      alert("Estoque insuficiente!");
      return;
    }
    setCartItems(prev => {
      const existing = prev.find(i => i.variantId === variant.id);
      if (existing) {
        if (existing.quantity + 1 > Number(variant.availableStock)) {
          alert("Estoque insuficiente para adicionar mais uma unidade.");
          return prev;
        }
        return prev.map(i => i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        variantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        barcodeSnapshot: variant.barcode,
        quantity: 1,
        unitPrice: Number(variant.salePrice),
        discount: 0,
        costPriceAtSale: Number(variant.costPrice || 0),
        salePriceAtSale: Number(variant.salePrice),
        marginAtSale: variant.costPrice ? ((Number(variant.salePrice) - Number(variant.costPrice)) / Number(variant.salePrice)) * 100 : 100,
        availableStock: Number(variant.availableStock)
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

  const updateItemDiscount = (variantId: string, val: string) => {
    setCartItems(prev => prev.map(i => i.variantId === variantId ? { ...i, discount: Number(val) } : i));
  };

  // Math
  const subtotal = cartItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  const itemsDiscount = cartItems.reduce((acc, i) => acc + (i.discount * i.quantity), 0);
  const total = subtotal - itemsDiscount - globalDiscount;
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
      const balance = Number(selectedCustomer.wallet?.balance || 0);
      if (balance < amount) {
        alert(`Saldo insuficiente na carteira (Saldo: R$ ${balance.toFixed(2)}).`);
        return;
      }
    }

    setPayments(prev => [...prev, {
      paymentMethodId: pm.id,
      name: pm.name,
      amount,
      installments: 1
    }]);
    setPaymentAmount("");
    setSelectedPaymentMethod("");
  };

  const removePayment = (idx: number) => {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFinalize = async (pin?: string, reason?: string) => {
    if (cartItems.length === 0) return alert("Carrinho vazio!");
    if (!selectedSeller) return alert("Selecione um vendedor!");
    if (totalPaid < total - 0.01) return alert("O valor pago não cobre o total da venda!");
    if (!activeProfile?.empresaId) return;

    setLoading(true);
    setPinError("");
    const res = await createSaleAction({
      companyId: activeProfile.empresaId,
      sellerId: selectedSeller,
      customerId: selectedCustomer?.id,
      customerNameSnapshot: selectedCustomer?.name,
      subtotal,
      discountAmount: itemsDiscount + globalDiscount,
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
      authPin: pin,
      authReason: reason
    });

    setLoading(false);
    if (res.success) {
      alert("Venda finalizada com sucesso!");
      // Reset PDV
      setCartItems([]);
      setPayments([]);
      setSelectedCustomer(null);
      setGlobalDiscount(0);
      setShowPinModal(false);
      setAuthPin("");
      setAuthReason("");
      router.push(`/comercial/vendas/${res.sale!.id}`);
    } else {
      if (res.error?.includes("excede o limite permitido")) {
        setShowPinModal(true);
      } else if (res.error?.includes("PIN de autorização inválido") && showPinModal) {
        setPinError(res.error);
      } else {
        alert("Erro ao finalizar venda:\n" + res.error);
      }
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="h-[calc(100vh-6rem)] overflow-hidden flex flex-col p-4 bg-slate-50 gap-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-md border shadow-sm shrink-0">
        <h1 className="text-xl font-bold text-slate-800">PDV / Frente de Caixa</h1>
        <div className="flex items-center gap-4">
          <select 
            className="border rounded px-2 py-1 text-sm bg-slate-50"
            value={selectedSeller}
            onChange={e => setSelectedSeller(e.target.value)}
          >
            <option value="">Selecione Vendedor...</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <Link href="/comercial/vendas"><Button variant="outline" size="sm">Voltar</Button></Link>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Esquerda: Produtos e Carrinho */}
        <div className="flex-[2] flex flex-col gap-4 overflow-hidden">
          {/* Busca Produto */}
          <Card className="shrink-0">
            <CardContent className="p-4 flex gap-2">
              <Input 
                placeholder="Código de barras, SKU ou Nome do Produto..." 
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchProduct()}
                autoFocus
              />
              <Button onClick={handleSearchProduct}><Search className="w-4 h-4" /></Button>
            </CardContent>
          </Card>

          {/* Resultados Busca Produto */}
          {searchResults.length > 0 && (
            <Card className="shrink-0 max-h-48 overflow-y-auto">
              <CardContent className="p-2 divide-y">
                {searchResults.map(v => (
                  <div key={v.id} className="flex justify-between items-center p-2 hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-sm">{v.product.name} - {v.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {v.sku} | Barcode: {v.barcode || '-'} | Estoque: {v.availableStock}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-green-600">{formatCurrency(Number(v.salePrice))}</p>
                      <Button size="sm" onClick={() => addToCart(v)}>Adicionar</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Carrinho */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 shrink-0"><CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Carrinho de Compras</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Produto</th>
                    <th className="p-2 text-center w-24">Qtd</th>
                    <th className="p-2 text-right">Preço</th>
                    <th className="p-2 text-right w-24">Desc/Un</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cartItems.map((item) => (
                    <tr key={item.variantId} className="hover:bg-slate-50">
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
                        <Input 
                          type="number" 
                          min={0} max={item.unitPrice} 
                          className="h-7 text-right text-xs" 
                          value={item.discount}
                          onChange={(e) => updateItemDiscount(item.variantId, e.target.value)}
                        />
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
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">O carrinho está vazio.</td>
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
                    placeholder="Buscar cliente..." 
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchCustomer()}
                  />
                  <Button variant="outline" onClick={handleSearchCustomer}><Search className="w-4 h-4" /></Button>
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
                  <div className="w-24">
                    <Input 
                      type="number" 
                      className="h-7 text-right bg-slate-700 border-slate-600 text-white" 
                      value={globalDiscount}
                      onChange={e => setGlobalDiscount(Number(e.target.value))}
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
                
                <div className="flex gap-2">
                  <select 
                    className="flex-1 h-9 rounded bg-slate-800 border-slate-600 text-sm px-2"
                    value={selectedPaymentMethod}
                    onChange={e => {
                      setSelectedPaymentMethod(e.target.value);
                      if (remainingToPay > 0) setPaymentAmount(remainingToPay.toFixed(2));
                    }}
                  >
                    <option value="">Selecione o Meio...</option>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>
                  <Input 
                    type="number" 
                    placeholder="R$ 0,00"
                    className="w-24 h-9 bg-slate-800 border-slate-600 text-right"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                  />
                  <Button onClick={addPayment} className="h-9 px-3 bg-green-600 hover:bg-green-500"><Plus className="w-4 h-4"/></Button>
                </div>

                <div className="space-y-2 mt-2 max-h-24 overflow-y-auto">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-800 p-2 rounded text-sm">
                      <span>{p.name}</span>
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
            
            <div className="p-4 bg-slate-900 rounded-b-xl shrink-0">
              <Button 
                className="w-full h-16 text-lg" 
                size="lg"
                disabled={loading}
                onClick={() => handleFinalize()}
              >
                {loading ? "Processando..." : "FINALIZAR VENDA"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Auth PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Autorização Necessária</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-slate-600">O desconto aplicado excede o seu limite. Solicite a autorização de um administrador.</p>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">PIN do Administrador</label>
                <Input 
                  type="password" 
                  value={authPin} 
                  onChange={e => setAuthPin(e.target.value)} 
                  placeholder="******" 
                  autoFocus 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">Motivo (Opcional)</label>
                <Input 
                  value={authReason} 
                  onChange={e => setAuthReason(e.target.value)} 
                  placeholder="Ex: Cliente VIP..." 
                />
              </div>

              {pinError && <p className="text-sm text-red-500 font-bold">{pinError}</p>}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowPinModal(false); setPinError(""); }}>Cancelar</Button>
                <Button onClick={() => handleFinalize(authPin, authReason)} disabled={loading || !authPin}>
                  {loading ? "Validando..." : "Autorizar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
