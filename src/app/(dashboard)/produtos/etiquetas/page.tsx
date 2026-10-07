'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLabelTemplates, deleteLabelTemplate } from '@/lib/crm/labels-actions';
import { ConfigPageHeader, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit3, Trash2, Tag, Info, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export default function LabelsPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await getLabelTemplates();
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        toast({ title: 'Erro', description: res.error || 'Erro ao carregar modelos', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o modelo "${name}"?`)) return;
    try {
      const res = await deleteLabelTemplate(id);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Modelo excluído com sucesso.' });
        loadTemplates();
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir modelo.', variant: 'destructive' });
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ConfigPageHeader
          title="Etiquetas"
          description="Modelos de impressão e geração de etiquetas de produtos."
          breadcrumb={[
            { label: 'Início', href: '/' },
            { label: 'Produtos', href: '/produtos' },
            { label: 'Etiquetas' }
          ]}
        />
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="border-slate-300">
            <Link href="/produtos/etiquetas/gerar">
              <Printer className="mr-2 h-4 w-4" /> Gerar etiquetas
            </Link>
          </Button>
          <Button asChild className="bg-[#12213a] hover:bg-[#0a1424] text-white">
            <Link href="/produtos/etiquetas/novo">
              <Plus className="mr-2 h-4 w-4" /> Adicionar modelo
            </Link>
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 shadow-sm max-w-4xl">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Etiquetas: Crie modelos de etiquetas de produtos para impressão em vários padrões diferentes.
        </AlertDescription>
      </Alert>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome do modelo..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="rounded-md border overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader className="bg-slate-50">
              <ConfigDataTableRow>
                <ConfigDataTableHead>Nome do Modelo</ConfigDataTableHead>
                <ConfigDataTableHead>Tamanho da página</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Carregando modelos...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredTemplates.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhum modelo encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredTemplates.map(template => (
                  <ConfigDataTableRow key={template.id} className="hover:bg-slate-50/50">
                    <ConfigDataTableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                          <Tag className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{template.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{template.presetName || 'Personalizado'}</div>
                        </div>
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-slate-600">
                      {template.paperSize}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild title="Editar Modelo">
                          <Link href={`/produtos/etiquetas/${template.id}/editar`}><Edit3 className="h-4 w-4 text-amber-600" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id, template.name)} title="Excluir Modelo">
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
          Registros: {filteredTemplates.length} no total
        </div>
      </div>
    </div>
  );
}
