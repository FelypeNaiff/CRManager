'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getProductCategories, archiveProductCategory } from '@/lib/crm/products-actions';
import { ConfigPageHeader, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit3, Trash2, FolderTree, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function GruposProdutoPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Exclusão modal
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await getProductCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      } else {
        toast({ title: 'Erro', description: res.error || 'Erro ao carregar grupos', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const confirmDelete = (id: string, name: string) => {
    setCategoryToDelete({ id, name });
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const res = await archiveProductCategory(categoryToDelete.id);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Grupo excluído com sucesso.' });
        loadCategories();
        setIsDeleteDialogOpen(false);
      } else {
        toast({ title: 'Aviso', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir grupo.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ConfigPageHeader
          title="Grupos de produto"
          description="Organize seus produtos em categorias."
          breadcrumb={[
            { label: 'Início', href: '/' },
            { label: 'Produtos', href: '/produtos' },
            { label: 'Grupos de produto' }
          ]}
        />
        <div className="flex items-center gap-3">
          <Button asChild className="bg-[#12213a] hover:bg-[#0a1424] text-white">
            <Link href="/produtos/grupos/novo">
              <Plus className="mr-2 h-4 w-4" /> Adicionar grupo
            </Link>
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 shadow-sm max-w-4xl">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Grupos de produto: Organize seus produtos em categorias para facilitar buscas, controle de comissões e relatórios de estoque.
        </AlertDescription>
      </Alert>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome do grupo..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="rounded-md border overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader className="bg-slate-50">
              <ConfigDataTableRow>
                <ConfigDataTableHead>Nome</ConfigDataTableHead>
                <ConfigDataTableHead>Produtos vinculados</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Carregando grupos...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredCategories.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhum grupo encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredCategories.map(category => (
                  <ConfigDataTableRow key={category.id} className="hover:bg-slate-50/50">
                    <ConfigDataTableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                          <FolderTree className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <Link href={`/produtos/grupos/${category.id}/editar`} className="font-semibold text-slate-900 hover:underline">
                            {category.name}
                          </Link>
                          {category.description && (
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{category.description}</div>
                          )}
                        </div>
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border">
                        {category._count?.products || 0} produtos
                      </span>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild title="Editar Grupo">
                          <Link href={`/produtos/grupos/${category.id}/editar`}><Edit3 className="h-4 w-4 text-amber-600" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(category.id, category.name)} title="Excluir Grupo">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </ConfigDataTableCell>
                  </ConfigDataTableRow>
                ))
              )}
            </ConfigDataTableBody>
          </ConfigDataTable>
        </div>
        
        <div className="text-xs text-muted-foreground text-right px-2 pt-2 border-t">
          Registros: {filteredCategories.length} no total
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o grupo <strong>{categoryToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="bg-amber-50 text-amber-800 border-amber-200">
              <AlertDescription>
                Esta ação inativará o grupo. Se houver produtos ativos vinculados a ele, a exclusão será bloqueada.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
