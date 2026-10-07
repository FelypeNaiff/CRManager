'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ConfigPageHeader, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Search, Printer, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getProducts } from '@/lib/crm/products-actions';
import { getLabelTemplates } from '@/lib/crm/labels-actions';

export default function GerarEtiquetasPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // selection state: { productId: quantity }
  const [selection, setSelection] = useState<Record<string, number>>({});
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const loadDependencies = async () => {
    setLoading(true);
    try {
      const [prodRes, tempRes] = await Promise.all([
        getProducts({ search: '' }) as any,
        getLabelTemplates() as any
      ]);
      
      if (prodRes?.success && prodRes?.data) setProducts(prodRes.data);
      if (tempRes?.success && tempRes?.data) setTemplates(tempRes.data);
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.internalCode && p.internalCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSel: Record<string, number> = {};
      filteredProducts.forEach(p => { newSel[p.id] = 1; });
      setSelection(newSel);
    } else {
      setSelection({});
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelection(prev => {
      const copy = { ...prev };
      if (checked) {
        copy[id] = 1;
      } else {
        delete copy[id];
      }
      return copy;
    });
  };

  const handleQuantityChange = (id: string, qty: number) => {
    if (qty < 1) return;
    setSelection(prev => ({
      ...prev,
      [id]: qty
    }));
  };

  const selectedCount = Object.keys(selection).length;

  const handlePrintSubmit = () => {
    if (!selectedTemplateId) {
      toast({ title: 'Aviso', description: 'Selecione um padrão de impressão.', variant: 'destructive' });
      return;
    }
    
    // Build array of items
    const items = Object.entries(selection).map(([id, qty]) => `${id}:${qty}`).join(',');
    
    // Open print page in new tab
    const url = `/produtos/etiquetas/imprimir?templateId=${selectedTemplateId}&items=${items}`;
    window.open(url, '_blank');
    setIsPrintModalOpen(false);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ConfigPageHeader
          title="Gerar Etiquetas"
          description="Selecione os produtos e imprima suas etiquetas."
          breadcrumb={[
            { label: 'Início', href: '/' },
            { label: 'Produtos', href: '/produtos' },
            { label: 'Etiquetas', href: '/produtos/etiquetas' },
            { label: 'Gerar' }
          ]}
        />
        <div className="flex items-center gap-3">
          <Button 
            className="bg-[#12213a] hover:bg-[#0a1424] text-white"
            disabled={selectedCount === 0}
            onClick={() => setIsPrintModalOpen(true)}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir etiquetas
          </Button>
        </div>
      </div>

      <Alert className="bg-amber-50/50 text-amber-800 border-amber-200 shadow-sm max-w-4xl">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          Selecione os produtos depois clique no botão acima "Imprimir etiquetas".
        </AlertDescription>
      </Alert>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por código ou nome..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="rounded-md border overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader className="bg-slate-50">
              <ConfigDataTableRow>
                <ConfigDataTableHead className="w-[50px] text-center">
                  <Checkbox 
                    checked={filteredProducts.length > 0 && selectedCount === filteredProducts.length}
                    onCheckedChange={handleSelectAll}
                  />
                </ConfigDataTableHead>
                <ConfigDataTableHead className="w-[80px]">Qnt.</ConfigDataTableHead>
                <ConfigDataTableHead>Código interno</ConfigDataTableHead>
                <ConfigDataTableHead>Código de barra</ConfigDataTableHead>
                <ConfigDataTableHead>Nome</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Vr. Varejo</ConfigDataTableHead>
                <ConfigDataTableHead className="text-center">Estoque</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando produtos...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredProducts.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredProducts.map(p => {
                  const isSelected = !!selection[p.id];
                  const qty = selection[p.id] || 1;
                  return (
                    <ConfigDataTableRow key={p.id} className="hover:bg-slate-50/50">
                      <ConfigDataTableCell className="text-center">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={(c) => handleSelectOne(p.id, c as boolean)}
                        />
                      </ConfigDataTableCell>
                      <ConfigDataTableCell>
                        <Input 
                          type="number" 
                          className="h-8 w-16 px-2 text-center" 
                          value={isSelected ? qty : ''} 
                          disabled={!isSelected}
                          onChange={(e) => handleQuantityChange(p.id, parseInt(e.target.value) || 1)}
                        />
                      </ConfigDataTableCell>
                      <ConfigDataTableCell className="font-mono text-xs">{p.internalCode || '-'}</ConfigDataTableCell>
                      <ConfigDataTableCell className="font-mono text-xs">{p.barcode || '-'}</ConfigDataTableCell>
                      <ConfigDataTableCell className="font-semibold text-slate-800">{p.name}</ConfigDataTableCell>
                      <ConfigDataTableCell className="text-right font-medium">R$ {Number(p.salePrice).toFixed(2)}</ConfigDataTableCell>
                      <ConfigDataTableCell className="text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-bold border">
                          {p.currentStock || 0}
                        </span>
                      </ConfigDataTableCell>
                    </ConfigDataTableRow>
                  );
                })
              )}
            </ConfigDataTableBody>
          </ConfigDataTable>
        </div>
        
        <div className="text-xs text-muted-foreground text-right px-2 pt-2 border-t">
          {selectedCount} selecionados / Registros: {filteredProducts.length} no total
        </div>
      </div>

      {/* Impressão Modal */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" /> Imprimir etiquetas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-sm">
              Selecione o padrão de impressão das etiquetas.
            </div>
            
            <div className="space-y-2">
              <Label>Modelo de etiqueta</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>Cancelar</Button>
              <Button className="bg-[#12213a] text-white hover:bg-[#0a1424]" onClick={handlePrintSubmit}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
