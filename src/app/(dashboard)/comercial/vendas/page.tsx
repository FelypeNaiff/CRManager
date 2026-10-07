"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { 
  ShoppingCart, Search, Download, Plus, Loader2, Eye, Printer, XCircle, RotateCcw, Calendar as CalendarIcon
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

import { listSalesAction } from "@/lib/sales/actions/list-sales-action";
import { listSellersAction } from "@/lib/sales/actions/list-sellers-action";
import { searchCustomersAction } from "@/lib/sales/actions/search-sales-entities-action";

export default function VendasRetaguardaPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ sales: any[], totalCount: number, page: number, pageSize: number }>({ sales: [], totalCount: 0, page: 1, pageSize: 20 });
  const [sellers, setSellers] = useState<any[]>([]);
  
  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sellerId, setSellerId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = { page, pageSize: 20 };
      if (statusFilter !== "ALL") filters.status = statusFilter;
      if (sellerId !== "ALL") filters.sellerId = sellerId;
      if (dateFrom) filters.startDate = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filters.endDate = to;
      }

      const res = await listSalesAction("AUTO", filters); // companyId is ignored on server-side because auth handles it
      if (res.success && res.sales) {
        setData({ sales: res.sales, totalCount: res.totalCount || 0, page: res.page || 1, pageSize: res.pageSize || 20 });
      } else {
        toast({ variant: "destructive", title: "Erro ao carregar vendas", description: res.error });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar vendas" });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sellerId, dateFrom, dateTo]);

  const loadSellers = useCallback(async () => {
    try {
      const res = await listSellersAction("AUTO");
      if (res.success && res.sellers) {
        setSellers(res.sellers);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadSellers();
  }, [loadSellers]);

  const renderBadge = (status: string) => {
    if (status === "COMPLETED") return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">Concluída</Badge>;
    if (status === "CANCELLED") return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">Cancelada</Badge>;
    if (status === "DRAFT") return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-0">Rascunho</Badge>;
    return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0">{status}</Badge>;
  };

  const totalFaturamento = data.sales.filter(s => s.status === 'COMPLETED').reduce((acc, s) => acc + Number(s.totalAmount), 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">&gt;</span>
        <span className="cursor-pointer hover:underline">Vendas</span>
        <span className="mx-2">&gt;</span>
        <span className="font-semibold text-foreground">Pedidos e Vendas</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-sidebar-foreground" /> Vendas
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-2">
          <Button className="bg-[#1e2229] hover:bg-black text-white h-8 rounded-sm px-3 text-[13px]" onClick={() => router.push("/pdv")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Venda (PDV)
          </Button>
          <Button variant="ghost" className="h-8 rounded-sm px-3 text-[13px] text-slate-600">
            <Download className="h-3.5 w-3.5 mr-2" /> Exportar planilhas
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 border rounded-sm px-2 bg-white">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 border-0 shadow-none w-32 px-1 text-[13px]" />
            <span className="text-muted-foreground text-[13px]">até</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 border-0 shadow-none w-32 px-1 text-[13px]" />
          </div>
          
          <Select value={sellerId} onValueChange={setSellerId}>
            <SelectTrigger className="h-8 w-40 text-[13px] bg-white rounded-sm border-gray-300">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Vendedores</SelectItem>
              {sellers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-40 text-[13px] bg-white rounded-sm border-gray-300">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as situações</SelectItem>
              <SelectItem value="COMPLETED">Concluída</SelectItem>
              <SelectItem value="DRAFT">Rascunho</SelectItem>
              <SelectItem value="CANCELLED">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left whitespace-nowrap">
            <thead className="text-foreground uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Nº Venda</th>
                <th className="px-4 py-3 font-semibold">Data / Hora</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Vendedor</th>
                <th className="px-4 py-3 font-semibold text-center">Qtd. Itens</th>
                <th className="px-4 py-3 font-semibold">Pagamento</th>
                <th className="px-4 py-3 font-semibold text-right">Valor Total</th>
                <th className="px-4 py-3 font-semibold text-center">Situação</th>
                <th className="px-4 py-3 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando vendas...
                  </td>
                </tr>
              ) : data.sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Nenhuma venda encontrada para os filtros.</td>
                </tr>
              ) : (
                data.sales.map((sale) => (
                  <tr key={sale.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-600">#{sale.saleNumber || sale.id.split('-')[0]}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {sale.customerNameSnapshot || sale.customer?.name || "Consumidor Final"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{sale.seller?.name || "Vendedor Padrão"}</td>
                    <td className="px-4 py-3 text-center">{sale.items?.reduce((acc: any, i: any) => acc + i.quantity, 0) || 0}</td>
                    <td className="px-4 py-3">
                      {sale.payments?.map((p: any) => p.paymentMethod?.name).join(', ') || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      R$ {Number(sale.totalAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-3 text-center">{renderBadge(sale.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {sale.status === 'COMPLETED' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600" title="Imprimir Cupom">
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {sale.status === 'DRAFT' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Continuar" onClick={() => router.push(`/pdv?draftId=${sale.id}`)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {sale.status !== 'CANCELLED' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" title="Cancelar Venda">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 border shadow-sm rounded-sm gap-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Faturamento (Concluídas):</span>
            <span className="font-bold text-green-700">R$ {totalFaturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex items-center gap-2 border-l pl-4">
            <span className="text-[12px] text-muted-foreground">Total de registros: {data.totalCount}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>Anterior</Button>
          <span className="text-sm px-4 py-2 bg-gray-50 border rounded-sm">Página {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={loading || data.sales.length < data.pageSize}>Próximo</Button>
        </div>
      </div>

    </div>
  );
}
