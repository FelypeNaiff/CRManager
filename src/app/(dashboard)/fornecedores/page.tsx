"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search, Loader2, Edit, Trash2, Mail, Phone } from "lucide-react";

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

import { getSuppliers, archiveSupplierAction } from "@/lib/crm/supplier-actions";

export default function FornecedoresPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSuppliers({ search, page, pageSize });
      if (res.success && 'data' in res && res.data) {
        setSuppliers(res.data);
        setTotal('total' in res ? res.total || 0 : 0);
      } else {
        toast({ variant: "destructive", title: "Erro ao carregar fornecedores", description: 'error' in res ? String(res.error) : "Erro desconhecido" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro de rede" });
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const delay = setTimeout(() => {
      loadData();
    }, search ? 400 : 0);
    return () => clearTimeout(delay);
  }, [search, page, loadData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await archiveSupplierAction(deleteId);
      if (res.success) {
        toast({ title: "Fornecedor arquivado com sucesso!" });
        loadData();
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error });
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
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">&gt;</span>
        <span className="font-semibold text-foreground">Fornecedores</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-sidebar-foreground" /> Fornecedores
        </h1>
      </div>

      <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-md flex items-start gap-3">
        <Building2 className="h-5 w-5 mt-0.5 opacity-80" />
        <div>
          <h3 className="font-bold">Fornecedores</h3>
          <p className="text-sm opacity-90 mt-1">
            Cadastre e gerencie as empresas e parceiros que fornecem mercadorias para o seu negócio. Mantenha os dados de contato e os endereços atualizados para facilitar as compras.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <Button className="bg-[#1e2229] hover:bg-black text-white h-8 rounded-sm px-3 text-[13px]" onClick={() => router.push("/fornecedores/novo")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar fornecedor
        </Button>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..." 
            className="pl-9 h-8 rounded-sm text-[13px]" 
          />
        </div>
      </div>

      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left whitespace-nowrap">
            <thead className="text-foreground uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Razão Social / Nome</th>
                <th className="px-4 py-3 font-semibold">Nome Fantasia</th>
                <th className="px-4 py-3 font-semibold">CNPJ / CPF</th>
                <th className="px-4 py-3 font-semibold">Contato</th>
                <th className="px-4 py-3 font-semibold">Localidade</th>
                <th className="px-4 py-3 font-semibold text-center">Produtos</th>
                <th className="px-4 py-3 font-semibold text-center">Situação</th>
                <th className="px-4 py-3 font-semibold text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando fornecedores...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">{sup.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sup.tradeName || "-"}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{sup.cnpjCpf || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col gap-1">
                        {sup.mobile || sup.phone ? (
                          <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" /> {sup.mobile || sup.phone}</div>
                        ) : null}
                        {sup.email ? (
                          <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {sup.email}</div>
                        ) : null}
                        {!sup.mobile && !sup.phone && !sup.email && "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sup.city && sup.state ? `${sup.city} / ${sup.state}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                        {sup._count.products + sup._count.productLinks} produtos
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sup.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">Ativo</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0">Inativo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Editar" onClick={() => router.push(`/fornecedores/${sup.id}/editar`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" title="Excluir" onClick={() => setDeleteId(sup.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground font-semibold">Total de fornecedores: {total}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>Anterior</Button>
          <span className="text-sm px-4 py-2 bg-gray-50 border rounded-sm">Página {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={loading || suppliers.length < pageSize}>Próximo</Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso arquivará o fornecedor e o removerá das listagens ativas. Se houver produtos em estoque associados a este fornecedor, a exclusão será bloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white" disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir Fornecedor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
