'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getProductGrades, deleteProductGrade } from '@/lib/crm/grades-actions';
import { ConfigPageHeader, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit3, Trash2, Layers, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export default function GradesPage() {
  const { toast } = useToast();
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadGrades = async () => {
    setLoading(true);
    try {
      const res = await getProductGrades();
      if (res.success && res.data) {
        setGrades(res.data);
      } else {
        toast({ title: 'Erro', description: res.error || 'Erro ao carregar grades', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrades();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a grade "${name}"?`)) return;
    try {
      const res = await deleteProductGrade(id);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Grade excluída com sucesso.' });
        loadGrades();
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir grade.', variant: 'destructive' });
    }
  };

  const filteredGrades = grades.filter(grade => 
    grade.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ConfigPageHeader
          title="Grades e Variações"
          description="Gerencie as características variáveis (Cor, Tamanho, etc) e seus valores."
          breadcrumb={[
            { label: 'Início', href: '/' },
            { label: 'Produtos', href: '/produtos' },
            { label: 'Grades' }
          ]}
        />
        <div className="flex items-center gap-3">
          <Button asChild className="bg-[#12213a] hover:bg-[#0a1424] text-white">
            <Link href="/produtos/grades/novo">
              <Plus className="mr-2 h-4 w-4" /> Adicionar Grade
            </Link>
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 shadow-sm max-w-4xl">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Durante o cadastro de produtos, é possível informar as variações construídas aqui. Por exemplo: Tamanho, cor, gênero, numeração, etc.
        </AlertDescription>
      </Alert>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome da grade..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="rounded-md border overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader className="bg-slate-50">
              <ConfigDataTableRow>
                <ConfigDataTableHead>Nome da Grade</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Carregando grades...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredGrades.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Nenhuma grade encontrada.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredGrades.map(grade => (
                  <ConfigDataTableRow key={grade.id} className="hover:bg-slate-50/50">
                    <ConfigDataTableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                          <Layers className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{grade.name}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {grade.options?.slice(0, 5).map((opt: any) => (
                              <span key={opt.id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium border">
                                {opt.name}
                              </span>
                            ))}
                            {grade.options?.length > 5 && (
                              <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-md font-medium border border-dashed">
                                +{grade.options.length - 5}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild title="Editar Grade">
                          <Link href={`/produtos/grades/${grade.id}/editar`}><Edit3 className="h-4 w-4 text-amber-600" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(grade.id, grade.name)} title="Excluir Grade">
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
          Registros: {filteredGrades.length} no total
        </div>
      </div>
    </div>
  );
}
