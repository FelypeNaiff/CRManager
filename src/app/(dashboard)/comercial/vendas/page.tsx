"use client";

import { useEffect, useState } from "react";
import { listSalesAction } from "@/lib/sales/actions/list-sales-action";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";

export default function VendasPage() {
  const { activeProfile } = useProfile();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState("");

  const loadSales = async () => {
    if (!activeProfile?.empresaId) return;
    setLoading(true);
    const res = await listSalesAction(activeProfile.empresaId, {
      sellerId: sellerId || undefined,
      status: status || undefined
    });
    if (res.success) {
      setSales(res.sales || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, [activeProfile?.empresaId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Vendas</h1>
        <Link href="/comercial/vendas/nova">
          <Button><Plus className="w-4 h-4 mr-2" /> Nova Venda</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Input 
            placeholder="Filtrar por vendedor (ID)" 
            value={sellerId} 
            onChange={(e) => setSellerId(e.target.value)} 
          />
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          <Button onClick={loadSales}>Filtrar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted">
                <tr>
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Vendedor</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-4 text-center">Carregando...</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center">Nenhuma venda encontrada.</td></tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="border-t">
                      <td className="p-4">{new Date(sale.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4">{sale.customerNameSnapshot || "Cliente Avulso"}</td>
                      <td className="p-4">{sale.seller?.nome || "Sistema"}</td>
                      <td className="p-4">{sale.status}</td>
                      <td className="p-4">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(sale.totalAmount))}
                      </td>
                      <td className="p-4">
                        <Link href={`/comercial/vendas/${sale.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
