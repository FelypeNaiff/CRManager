"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSaleAction } from "@/lib/sales/actions/get-sale-action";
import { cancelSaleAction } from "@/lib/sales/actions/cancel-sale-action";
import { getSaleInventoryMovementsAction } from "@/lib/sales/actions/get-sale-inventory-movements-action";
import { useProfile } from "@/lib/contexts/profile-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Ban } from "lucide-react";
import Link from "next/link";

export default function DetalheVendaPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { activeProfile } = useProfile();
  const { hasRole } = usePermissions();
  
  const [sale, setSale] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Cancelamento (simples mock para fluxo)
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const loadSale = async () => {
    setLoading(true);
    const res = await getSaleAction(id);
    if (res.success) {
      setSale(res.sale);
      const resMovs = await getSaleInventoryMovementsAction(id);
      if (resMovs.success) {
        setMovements(resMovs.movements || []);
      }
    } else {
      alert("Erro ao buscar venda: " + res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) loadSale();
  }, [id]);

  const handleCancelSale = async () => {
    if (!activeProfile?.userId || !cancelReason) return;
    if (!confirm("Tem certeza que deseja cancelar esta venda? Esta ação é irreversível e irá estornar estoque, metas e comissões.")) return;
    
    setIsCancelling(true);
    const res = await cancelSaleAction({
      saleId: id,
      cancelReason,
      cancelledByUserId: activeProfile.userId
    });
    
    setIsCancelling(false);
    if (res.success) {
      alert("Venda cancelada com sucesso!");
      loadSale();
      setCancelReason("");
    } else {
      alert("Erro ao cancelar: " + res.error);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!sale) return <div className="p-6">Venda não encontrada.</div>;

  const canCancel = hasRole("admin") || hasRole("gerente");

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/comercial/vendas">
          <Button variant="ghost"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
        </Link>
        <h1 className="text-3xl font-bold">Venda #{sale.id.slice(0,8).toUpperCase()}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          sale.status === 'PAID' ? 'bg-green-100 text-green-800' : 
          sale.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {sale.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Detalhes da Venda</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Data:</strong> {new Date(sale.createdAt).toLocaleString("pt-BR")}</p>
            <p><strong>Cliente:</strong> {sale.customerNameSnapshot || "Cliente Avulso"}</p>
            <p><strong>Vendedor:</strong> {sale.seller?.nome || "Sistema"}</p>
            <p><strong>Subtotal:</strong> {formatCurrency(sale.subtotal)}</p>
            <p><strong>Desconto:</strong> {formatCurrency(sale.discountAmount)}</p>
            <p className="text-lg font-bold"><strong>Total:</strong> {formatCurrency(sale.totalAmount)}</p>
            {sale.status === 'CANCELLED' && (
              <div className="mt-4 p-3 bg-red-50 text-red-800 rounded-md">
                <p><strong>Cancelada por:</strong> {sale.cancelledBy?.nome || sale.cancelledByUserId}</p>
                <p><strong>Data Cancelamento:</strong> {new Date(sale.cancelledAt).toLocaleString("pt-BR")}</p>
                <p><strong>Motivo:</strong> {sale.cancelReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {sale.status !== 'CANCELLED' && canCancel ? (
              <div className="space-y-2">
                <Input 
                  placeholder="Motivo do cancelamento..." 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                />
                <Button 
                  variant="destructive" 
                  onClick={handleCancelSale} 
                  disabled={isCancelling || !cancelReason}
                  className="w-full"
                >
                  <Ban className="w-4 h-4 mr-2" /> Cancelar Venda
                </Button>
              </div>
            ) : sale.status !== 'CANCELLED' ? (
              <p className="text-sm text-muted-foreground">Você não tem permissão para cancelar esta venda.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Esta venda já foi cancelada.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Itens ({sale.items.length})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Produto</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Qtd</th>
                <th className="p-2">Preço Unit.</th>
                <th className="p-2">Desconto</th>
                <th className="p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.productNameSnapshot} - {item.variantNameSnapshot}</td>
                  <td className="p-2">{item.skuSnapshot}</td>
                  <td className="p-2">{Number(item.quantity)}</td>
                  <td className="p-2">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-2">{formatCurrency(item.discount)}</td>
                  <td className="p-2">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Comissões</CardTitle></CardHeader>
          <CardContent>
            {sale.commissions?.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {sale.commissions.map((c: any) => (
                  <li key={c.id} className="p-2 border rounded flex justify-between">
                    <span>Vendedor: {sale.seller?.nome}</span>
                    <span className="font-bold">{formatCurrency(c.amount)}</span>
                    <span className={`text-xs ${c.status === 'CANCELLED' ? 'text-red-600' : 'text-green-600'}`}>{c.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma comissão gerada para esta venda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Movimentações de Estoque</CardTitle></CardHeader>
          <CardContent>
            {movements?.length > 0 ? (
              <ul className="space-y-2 text-sm max-h-[200px] overflow-y-auto">
                {movements.map((m: any) => (
                  <li key={m.id} className="p-2 border rounded flex justify-between">
                    <span>{m.variant?.name || "Variante"} ({m.type})</span>
                    <span className={`font-bold ${m.type === 'SALE' ? 'text-red-600' : 'text-green-600'}`}>
                      {m.type === 'SALE' ? '-' : '+'}{Number(m.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
