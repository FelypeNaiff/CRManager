"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSaleAction } from "@/lib/sales/actions/get-sale-action";
import { processExchangeReturnAction } from "@/lib/sales/actions/create-exchange-action";

export default function TrocaIdPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { activeProfile } = useProfile();
  
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [returnItems, setReturnItems] = useState<{ variantId: string; quantity: number; condition: string }[]>([]);
  const [operationType, setOperationType] = useState("RETURN");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (activeProfile?.empresaId && id) {
      getSaleAction(id).then(res => {
        if (res.success && res.sale) {
          setSale(res.sale);
          // Initialize return items
          setReturnItems(res.sale.items.map((i: any) => ({
            variantId: i.variantId,
            quantity: 0,
            condition: "RESALE"
          })));
        }
        setLoading(false);
      });
    }
  }, [activeProfile, id]);

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!sale) return <div className="p-6">Venda não encontrada.</div>;
  if (!sale.customerId) return <div className="p-6 text-red-500 font-bold">Erro: Esta venda não possui cliente vinculado. Não é possível gerar crédito de devolução.</div>;

  const handleUpdateItem = (variantId: string, field: string, value: any) => {
    setReturnItems(prev => prev.map(i => i.variantId === variantId ? { ...i, [field]: value } : i));
  };

  const handleProcess = async () => {
    if (!activeProfile?.empresaId || !activeProfile?.userId) return;
    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0) return alert("Selecione ao menos um item para devolver.");

    setProcessing(true);
    const res = await processExchangeReturnAction({
      companyId: activeProfile.empresaId,
      userId: activeProfile.userId,
      saleId: sale.id,
      type: operationType as any,
      reason,
      items: itemsToReturn.map(i => ({
        variantId: i.variantId,
        quantity: Number(i.quantity),
        condition: i.condition as any
      }))
    });

    setProcessing(false);
    if (res.success) {
      alert(`Processado com sucesso! Crédito gerado: R$ ${res.totalCredit}`);
      if (operationType === "EXCHANGE") {
        router.push("/comercial/vendas/nova"); // Vai usar o crédito
      } else {
        router.push("/comercial/trocas");
      }
    } else {
      alert("Erro ao processar: " + res.error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Devolução / Troca - Venda #{sale.id.slice(0,8)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded border">
            <div>
              <p className="text-slate-500 font-bold">Cliente</p>
              <p>{sale.customer?.name}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold">Total da Venda</p>
              <p>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(sale.totalAmount))}</p>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4">Itens da Venda</h3>
            <div className="space-y-4">
              {sale.items.map((item: any) => {
                const returnItem = returnItems.find(i => i.variantId === item.variantId);
                if (!returnItem) return null;
                
                return (
                  <div key={item.id} className="p-4 border rounded flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold">{item.productNameSnapshot} - {item.variantNameSnapshot}</p>
                      <p className="text-xs text-slate-500">Comprado: {Number(item.quantity)} | Total: R$ {Number(item.totalPrice)}</p>
                    </div>
                    <div className="w-32">
                      <label className="text-xs font-bold text-slate-500">Qtd Devolver</label>
                      <Input 
                        type="number" 
                        min="0" 
                        max={Number(item.quantity)} 
                        value={returnItem.quantity} 
                        onChange={e => handleUpdateItem(item.variantId, "quantity", Number(e.target.value))} 
                      />
                    </div>
                    <div className="w-40">
                      <label className="text-xs font-bold text-slate-500">Condição</label>
                      <select 
                        className="w-full border rounded px-2 py-2 text-sm bg-white"
                        value={returnItem.condition}
                        onChange={e => handleUpdateItem(item.variantId, "condition", e.target.value)}
                      >
                        <option value="RESALE">Novo (Revenda)</option>
                        <option value="DAMAGED">Avariado</option>
                        <option value="DISCARD">Descarte</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Tipo de Operação</label>
              <select 
                className="w-full border rounded px-2 py-2 text-sm bg-white"
                value={operationType}
                onChange={e => setOperationType(e.target.value)}
              >
                <option value="RETURN">Devolução Simples</option>
                <option value="EXCHANGE">Troca (Gera crédito para nova venda)</option>
                <option value="WARRANTY">Garantia</option>
                <option value="DAMAGE">Avaria pelo Cliente</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Motivo</label>
              <Input 
                placeholder="Ex: Tamanho não serviu..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={() => router.push("/comercial/trocas")}>Cancelar</Button>
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? "Processando..." : "Confirmar Operação"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
