'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderTree, Save, X, Layers } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createProductCategory, updateCategory, getProductCategoryById } from '@/lib/crm/products-actions';

interface CategoryFormProps {
  categoryId?: string;
}

export default function CategoryForm({ categoryId }: CategoryFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!categoryId);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (categoryId) {
      loadCategory(categoryId);
    }
  }, [categoryId]);

  const loadCategory = async (id: string) => {
    try {
      const res = await getProductCategoryById(id);
      if (res.success && res.data) {
        setForm({
          name: res.data.name,
          description: res.data.description || '',
        });
      } else {
        toast({ title: 'Erro', description: res.error || 'Grupo não encontrado.', variant: 'destructive' });
        router.push('/produtos/grupos');
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar grupo.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Aviso', description: 'O nome do grupo é obrigatório.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = categoryId 
        ? await updateCategory(categoryId, form)
        : await createProductCategory(form);

      if (res.success) {
        toast({ title: 'Sucesso', description: categoryId ? 'Grupo atualizado.' : 'Grupo cadastrado.' });
        router.push('/produtos/grupos');
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao salvar grupo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando grupo...</div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white rounded-xl shadow-sm border text-slate-700">
          <FolderTree className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{categoryId ? 'Editar Grupo de Produto' : 'Novo Grupo de Produto'}</h1>
          <p className="text-slate-500 text-sm">Organize seus produtos categorizando-os em grupos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
            <div className="border-b pb-4 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Layers className="w-5 h-5 text-slate-400" /> Informe os dados do grupo de produto
              </h2>
              <p className="text-sm text-slate-500 mt-1">Defina o nome da categoria e observações adicionais.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do grupo *</Label>
                <Input 
                  placeholder="Ex: Bebidas, Vestuário Masculino, Calçados..." 
                  value={form.name} 
                  onChange={(e) => handleFieldChange("name", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea 
                  placeholder="Observações ou especificações (opcional)" 
                  value={form.description} 
                  onChange={(e) => handleFieldChange("description", e.target.value)} 
                  className="min-h-[100px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-end gap-3 md:pl-[280px]">
        <div className="max-w-[1400px] w-full mx-auto flex justify-end items-center gap-4 px-4 md:px-8">
          <Button 
            variant="outline" 
            onClick={() => router.push('/produtos/grupos')}
            className="border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors bg-white font-semibold shadow-sm"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[#12213a] hover:bg-[#0a1424] text-white shadow-md font-semibold px-8"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : (categoryId ? "Atualizar" : "Cadastrar")}
          </Button>
        </div>
      </div>
    </div>
  );
}
