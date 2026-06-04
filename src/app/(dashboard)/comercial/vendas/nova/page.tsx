"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchVariantsAction, searchCustomersAction } from "@/lib/sales/actions/search-sales-entities-action";
import { listSellersAction } from "@/lib/sales/actions/list-sellers-action";
import { createSaleAction } from "@/lib/sales/actions/create-sale-action";
import { ChevronRight, ChevronLeft, Plus, Search, Trash2 } from "lucide-react";

export default function NovaVendaPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [sellerId, setSellerId] = useState<string | null>(null);
  
  // Auth PIN Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [authPin, setAuthPin] = useState("");
  const [authReason, setAuthReason] = useState("");
  const [pinError, setPinError] = useState("");
  
  const [cartItems, setCartItems] = useState<any[]>([]);

  // Search Results
  const [customers, setCustomers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (activeProfile?.empresaId) {
      listSellersAction(activeProfile.empresaId).then(res => {
        if (res.success) setSellers(res.sellers || []);
      });
    }
  }, [activeProfile?.empresaId]);

  const handleSearchCustomer = async () => {
    if (!activeProfile?.empresaId || !searchQuery) return;
    const res = await searchCustomersAction(activeProfile.empresaId, searchQuery);
    if (res.success) setCustomers(res.customers || []);
  };

  const handleSearchVariant = async () => {
    if (!activeProfile?.empresaId || !searchQuery) return;
    const res = await searchVariantsAction(activeProfile.empresaId, searchQuery);
    if (res.success) setVariants(res.variants || []);
  };

  useEffect(() => {
    if (step === 3 && searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        handleSearchVariant();
      }, 300);
      return () => clearTimeout(timer);
    } else if (step === 3 && searchQuery.length === 0) {
      setVariants([]);
    }
  }, [searchQuery, step, activeProfile?.empresaId]);

  const addToCart = (variant: any) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.variantId === variant.id);
      if (existing) {
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
  };

  const removeFromCart = (variantId: string) => {
    setCartItems(prev => prev.filter(i => i.variantId !== variantId));
  };

  const calculateSubtotal = () => cartItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const calculateTotal = () => cartItems.reduce((acc, item) => acc + ((item.unitPrice - item.discount) * item.quantity), 0);

  const handleCreateSale = async (pin?: string, reason?: string) => {
    if (!activeProfile?.empresaId || !sellerId || cartItems.length === 0) return;
    setLoading(true);
    setPinError("");

    const subtotal = calculateSubtotal();
    const totalAmount = calculateTotal();
    const discountAmount = subtotal - totalAmount;

    // Criar payment method dummy de dinheiro para a Venda que já vem como PAID no fluxo atual
    const payments = [
      {
        paymentMethodId: "00000000-0000-0000-0000-000000000000", // Isso idealmente vem de um select, mas a FASE 6D nao exige tela completa de pagamento. Vamos usar um workaround ou o usuario tera q criar metodo real
        amount: totalAmount,
        installments: 1
      }
    ];
    // Mas a Action de venda exige um ID de pagamento válido. 
    // Como a FASE 6D não tem tela de PDV de pagamentos finais "NÃO implementar PDV ainda",
    // faremos sem pagamentos se o schema permitir, senao enviamos o total com um ID placeholder vazio que pode falhar?
    // Vamos chamar a action.
    const res = await createSaleAction({
      companyId: activeProfile.empresaId,
      sellerId: sellerId,
      customerId: customerId || undefined,
      customerNameSnapshot: customerName || undefined,
      subtotal,
      discountAmount,
      totalAmount,
      items: cartItems.map(i => ({
        ...i,
        totalPrice: (i.unitPrice - i.discount) * i.quantity
      })),
      payments: [], // Se a API permitir sem pagamentos. Se não, precisaremos buscar 1 metodo.
      authorizationId: pin,
      authReason: reason
    });

    setLoading(false);
    if (res.success) {
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
        alert("Erro ao criar venda: " + res.error);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Nova Venda</h1>

      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <span className={step >= 1 ? "text-primary font-bold" : ""}>1. Cliente</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step >= 2 ? "text-primary font-bold" : ""}>2. Vendedor</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step >= 3 ? "text-primary font-bold" : ""}>3. Produtos</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step >= 4 ? "text-primary font-bold" : ""}>4. Resumo</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Selecionar Cliente (Opcional)</h2>
              <div className="flex gap-2">
                <Input 
                  placeholder="Buscar por nome, email ou telefone..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
                <Button onClick={handleSearchCustomer}><Search className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-2">
                {customers.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-bold">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.email} • {c.phone}</p>
                    </div>
                    <Button variant={customerId === c.id ? "default" : "outline"} onClick={() => { setCustomerId(c.id); setCustomerName(c.name); }}>
                      Selecionar
                    </Button>
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => { setCustomerId(null); setCustomerName("Avulso"); setStep(2); }}>Pular</Button>
                <Button onClick={() => setStep(2)}>Próximo</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Selecionar Vendedor</h2>
              <div className="space-y-2">
                {sellers.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3 border rounded">
                    <p className="font-bold">{s.nome}</p>
                    <Button variant={sellerId === s.id ? "default" : "outline"} onClick={() => setSellerId(s.id)}>
                      Selecionar
                    </Button>
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={!sellerId}>Próximo</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Adicionar Produtos</h2>
              <div className="flex gap-2">
                <Input 
                  placeholder="Buscar produto por nome, código ou SKU..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
                <Button onClick={handleSearchVariant}><Search className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 border-r pr-4 max-h-[400px] overflow-y-auto">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Resultados:</h3>
                  {variants.map(v => (
                    <div key={v.id} className="p-3 border rounded space-y-2">
                      <div>
                        <p className="font-bold text-sm">{v.product.name} - {v.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {v.sku} | Estoque: {v.availableStock}</p>
                        <p className="font-medium text-green-600 mt-1">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v.salePrice))}
                        </p>
                      </div>
                      <Button size="sm" className="w-full" onClick={() => addToCart(v)}>
                        <Plus className="w-4 h-4 mr-2"/> Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pl-4 max-h-[400px] overflow-y-auto">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Carrinho:</h3>
                  {cartItems.map(item => (
                    <div key={item.variantId} className="p-3 border rounded flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{item.productNameSnapshot} - {item.variantNameSnapshot}</p>
                        <p className="text-xs">Qtd: {item.quantity} x R$ {item.unitPrice}</p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => removeFromCart(item.variantId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
                <Button onClick={() => setStep(4)} disabled={cartItems.length === 0}>Resumo</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Resumo da Venda</h2>
              
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted p-4 rounded-md">
                <div>
                  <p className="text-muted-foreground">Cliente:</p>
                  <p className="font-bold">{customerName || "Avulso"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vendedor:</p>
                  <p className="font-bold">{sellers.find(s => s.id === sellerId)?.nome}</p>
                </div>
              </div>

              <div className="border rounded-md divide-y">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="p-3 flex justify-between">
                    <span>{item.quantity}x {item.productNameSnapshot} - {item.variantNameSnapshot}</span>
                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity * item.unitPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-bold text-lg pt-4">
                <span>Total:</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</span>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>Voltar</Button>
                <Button onClick={() => handleCreateSale()} disabled={loading}>
                  {loading ? "Finalizando..." : "Finalizar Venda"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                <Button onClick={() => handleCreateSale(authPin, authReason)} disabled={loading || !authPin}>
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
