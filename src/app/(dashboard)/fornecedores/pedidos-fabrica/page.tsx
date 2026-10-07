"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Factory, Plus, Search, Loader2, Trash2, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getFactoryOrders, deleteFactoryOrder } from "@/lib/crm/factory-orders-actions";

export default function PedidosFabricaPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFactoryOrders(search);
      if (res.success && 'data' in res && res.data) {
        setOrders(res.data);
      } else {
        toast({ variant: "destructive", title: "Erro ao carregar pedidos", description: 'error' in res ? String(res.error) : "Erro desconhecido" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro de rede" });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const delay = setTimeout(() => {
      loadData();
    }, search ? 400 : 0);
    return () => clearTimeout(delay);
  }, [search, loadData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await deleteFactoryOrder(deleteId);
      if (res.success) {
        toast({ title: "Pedido excluído com sucesso!" });
        loadData();
      } else {
        toast({ variant: "destructive", title: "Erro", description: 'error' in res ? String(res.error) : "Erro desconhecido" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      
      <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#4f46e5] text-white p-4 rounded-2xl shadow-sm">
            <Factory className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-headline text-slate-800 tracking-tight uppercase">Pedido Fábrica</h1>
            <p className="text-sm text-slate-500 max-w-lg mt-1 font-medium">
              Lançamento de pedidos para fornecedores, separação por tamanhos e espelho de impressão (Representante & Loja SUFRAMA).
            </p>
          </div>
        </div>
        <Button className="bg-[#4f46e5] hover:bg-[#4338ca] text-white h-12 px-6 rounded-xl font-bold tracking-wide shadow-md hover:shadow-lg transition-all" onClick={() => router.push("/fornecedores/pedidos-fabrica/novo")}>
          <Plus className="h-5 w-5 mr-2" /> NOVO PEDIDO DE FÁBRICA
        </Button>
      </div>

      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <Input 
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por Nome da Fábrica, código do pedido ou operador..." 
          className="pl-12 h-12 rounded-xl text-base border-2 border-slate-200 focus-visible:border-[#4f46e5] shadow-sm font-semibold" 
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider ml-1">
          HISTÓRICO DE PEDIDOS DE FÁBRICA ({orders.length})
        </h2>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" /> Carregando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 font-bold">
            <Factory className="h-12 w-12 mx-auto mb-4 opacity-20" />
            Nenhum pedido de fábrica encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer" onClick={() => router.push(`/fornecedores/pedidos-fabrica/${order.id}`)}>
                
                <div className="flex items-start gap-4">
                  <div className="bg-slate-100 p-3 rounded-xl border">
                    <Factory className="h-6 w-6 text-slate-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-lg text-slate-800 uppercase">{order.factoryName}</span>
                      <Badge variant="outline" className="text-[10px] font-bold border-slate-300 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </Badge>
                      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 text-[10px] uppercase font-bold">
                        {order.orderNumber}
                      </Badge>
                    </div>
                    <div className="text-sm font-bold text-slate-500">
                      <span className="text-purple-600">{order._count.items}</span> itens lançados • <span className="text-purple-600">{order.totalPieces}</span> peças no total • Operador: {order.operatorName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-0.5">Valor Total</div>
                    <div className="font-black text-xl text-slate-800 line-through decoration-slate-300 decoration-2">R$ {Number(order.totalGross).toFixed(2)}</div>
                    <div className="text-sm font-bold text-green-600">Líquido: R$ {Number(order.totalNet).toFixed(2)}</div>
                  </div>
                  
                  <div className="flex items-center gap-2 pl-4 border-l">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={(e) => { e.stopPropagation(); setDeleteId(order.id); }}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                    <div className="h-10 w-10 flex items-center justify-center text-slate-400 bg-slate-50 rounded-full">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este pedido de fábrica? Os dados de espelho serão perdidos e não poderão ser recuperados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold" disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
