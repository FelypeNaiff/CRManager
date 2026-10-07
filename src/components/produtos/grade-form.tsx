'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Save, X, Layers, Grid } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createProductGrade, updateProductGrade, getProductGradeById } from '@/lib/crm/grades-actions';

interface GradeFormProps {
  gradeId?: string;
}

export default function GradeForm({ gradeId }: GradeFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!gradeId);
  
  const [name, setName] = useState('');
  const [options, setOptions] = useState([{ id: Date.now().toString(), value: '' }]);

  useEffect(() => {
    if (gradeId) {
      loadGrade(gradeId);
    }
  }, [gradeId]);

  const loadGrade = async (id: string) => {
    try {
      const res = await getProductGradeById(id);
      if (res.success && res.data) {
        setName(res.data.name);
        if (res.data.options && res.data.options.length > 0) {
          setOptions(res.data.options.map((opt: any) => ({
            id: opt.id,
            value: opt.name,
          })));
        } else {
          setOptions([{ id: Date.now().toString(), value: '' }]);
        }
      } else {
        toast({ title: 'Erro', description: res.error || 'Grade não encontrada.', variant: 'destructive' });
        router.push('/produtos/grades');
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar grade.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOption = () => {
    setOptions(prev => [...prev, { id: Date.now().toString(), value: '' }]);
  };

  const handleRemoveOption = (idToRemove: string) => {
    if (options.length === 1) {
      toast({ title: 'Aviso', description: 'A grade deve ter pelo menos uma variação.', variant: 'destructive' });
      return;
    }
    setOptions(prev => prev.filter(opt => opt.id !== idToRemove));
  };

  const handleOptionChange = (idToUpdate: string, newValue: string) => {
    setOptions(prev => prev.map(opt => opt.id === idToUpdate ? { ...opt, value: newValue } : opt));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Erro', description: 'O nome da grade é obrigatório.', variant: 'destructive' });
      return;
    }

    const validOptions = options.map(o => o.value.trim()).filter(v => v !== '');
    if (validOptions.length === 0) {
      toast({ title: 'Erro', description: 'Preencha ao menos uma variação.', variant: 'destructive' });
      return;
    }

    // Check duplicates
    const uniqueOptions = new Set(validOptions);
    if (uniqueOptions.size !== validOptions.length) {
      toast({ title: 'Erro', description: 'Existem variações duplicadas na lista.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = { name: name.trim(), options: validOptions };
      const res = gradeId 
        ? await updateProductGrade(gradeId, payload)
        : await createProductGrade(payload);

      if (res.success) {
        toast({ title: 'Sucesso', description: gradeId ? 'Grade atualizada.' : 'Grade cadastrada.' });
        router.push('/produtos/grades');
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao salvar grade.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando informações da grade...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white rounded-xl shadow-sm border text-slate-700">
          <Layers className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{gradeId ? 'Editar Grade' : 'Nova Grade'}</h1>
          <p className="text-slate-500 text-sm">{gradeId ? 'Edite o nome ou as opções disponíveis.' : 'Cadastre uma nova característica variável para seus produtos.'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Grid className="w-5 h-5 text-slate-400" /> Informe a grade</h2>
          <p className="text-sm text-slate-500 mt-1">Característica que varia entre os produtos: Cor, Tamanho, Voltagem... As variações são os valores possíveis (Azul, Verde; P, M, G).</p>
        </div>

        <div className="max-w-md space-y-2">
          <Label htmlFor="nome">Nome da grade *</Label>
          <Input 
            id="nome" 
            placeholder="Ex: Tamanho juvenil-infantil" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Layers className="w-5 h-5 text-slate-400" /> Cadastre as variações da grade</h2>
          <p className="text-sm text-slate-500 mt-1">Os valores que a grade pode ter no produto. Ao menos uma variação é necessária.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {options.map((opt, index) => (
            <div key={opt.id} className="flex flex-col gap-2">
              <Label className="text-slate-500">Variação {index + 1} *</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Ex: P, 36, Azul..." 
                  value={opt.value} 
                  onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handleRemoveOption(opt.id)}
                  className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                  title="Remover variação"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <Button 
            variant="outline" 
            onClick={handleAddOption}
            className="border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 bg-slate-50"
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar variação
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-end gap-3 md:pl-[280px]">
        <div className="max-w-[1400px] w-full mx-auto flex justify-end items-center gap-4 px-4 md:px-8">
          <Button 
            variant="outline" 
            onClick={() => router.push('/produtos/grades')}
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
            {isSaving ? "Salvando..." : (gradeId ? "Atualizar" : "Cadastrar")}
          </Button>
        </div>
      </div>
    </div>
  );
}
