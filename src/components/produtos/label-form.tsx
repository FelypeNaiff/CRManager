'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tag, Save, X, Search, FileText, Settings, Sliders } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createLabelTemplate, updateLabelTemplate, getLabelTemplateById, LABEL_PRESETS } from '@/lib/crm/labels-actions';

interface LabelFormProps {
  templateId?: string;
}

export default function LabelForm({ templateId }: LabelFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!templateId);
  
  const [form, setForm] = useState({
    name: '',
    presetName: '',
    paperSize: 'A4 – 21,0 X 29,7 cm',
    labelHeightCm: 2.12,
    labelWidthCm: 3.82,
    columnsOnPage: 5,
    rowsOnPage: 13,
    marginTopCm: 1.07,
    marginLeftCm: 0.45,
    verticalPitchCm: 2.12,
    horizontalPitchCm: 4.07,
    topDescription: '',
    maxCharsProductName: 30,
    fontFamily: 'Helvetica',
    fontSizePt: 6,
    showInternalCode: true,
    showBarcode: true,
    showBarcodeDigits: false,
    barcodePosition: 'Inferior',
    showPrice: true,
    priceFontSize: 'Padrão',
  });

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);

  const loadTemplate = async (id: string) => {
    try {
      const res = await getLabelTemplateById(id);
      if (res.success && res.data) {
        setForm({
          name: res.data.name,
          presetName: res.data.presetName || '',
          paperSize: res.data.paperSize,
          labelHeightCm: Number(res.data.labelHeightCm),
          labelWidthCm: Number(res.data.labelWidthCm),
          columnsOnPage: res.data.columnsOnPage,
          rowsOnPage: res.data.rowsOnPage,
          marginTopCm: Number(res.data.marginTopCm),
          marginLeftCm: Number(res.data.marginLeftCm),
          verticalPitchCm: Number(res.data.verticalPitchCm),
          horizontalPitchCm: Number(res.data.horizontalPitchCm),
          topDescription: res.data.topDescription || '',
          maxCharsProductName: res.data.maxCharsProductName || 30,
          fontFamily: res.data.fontFamily,
          fontSizePt: res.data.fontSizePt,
          showInternalCode: res.data.showInternalCode,
          showBarcode: res.data.showBarcode,
          showBarcodeDigits: res.data.showBarcodeDigits,
          barcodePosition: res.data.barcodePosition,
          showPrice: res.data.showPrice,
          priceFontSize: res.data.priceFontSize,
        });
      } else {
        toast({ title: 'Erro', description: res.error || 'Modelo não encontrado.', variant: 'destructive' });
        router.push('/produtos/etiquetas');
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar modelo.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePresetSelect = (presetName: string) => {
    if (presetName === 'Personalizado') {
      handleFieldChange('presetName', 'Personalizado');
      return;
    }
    const preset = LABEL_PRESETS.find(p => p.presetName === presetName);
    if (preset) {
      setForm(prev => ({
        ...prev,
        ...preset
      }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'O nome da etiqueta é obrigatório.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = { ...form };
      const res = templateId 
        ? await updateLabelTemplate(templateId, payload)
        : await createLabelTemplate(payload);

      if (res.success) {
        toast({ title: 'Sucesso', description: templateId ? 'Modelo atualizado.' : 'Modelo cadastrado.' });
        router.push('/produtos/etiquetas');
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao salvar modelo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando modelo...</div>;
  }

  // Folha preview cálculos baseados em A4 miniatura
  // A4 ratio 21 x 29.7
  const pageWidth = 210;
  const pageHeight = 297;
  const previewScale = 0.5; // 210 * 0.5 = 105px, 297 * 0.5 = 148px

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white rounded-xl shadow-sm border text-slate-700">
          <Tag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{templateId ? 'Editar Modelo de Etiqueta' : 'Novo Modelo de Etiqueta'}</h1>
          <p className="text-slate-500 text-sm">Configure as medidas da folha e a formatação de impressão.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Informe o modelo */}
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
            <div className="border-b pb-4 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><FileText className="w-5 h-5 text-slate-400" /> Informe o modelo da etiqueta</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Padrão da etiqueta</Label>
                <Select value={form.presetName} onValueChange={handlePresetSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecione um padrão ou personalize" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personalizado">Personalizado</SelectItem>
                    {LABEL_PRESETS.map(p => (
                      <SelectItem key={p.presetName} value={p.presetName}>{p.presetName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome da etiqueta *</Label>
                <Input placeholder="Ex: A4351 - Padrão Loja" value={form.name} onChange={(e) => handleFieldChange("name", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Card 2 e 3: Dimensões */}
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
            <div className="border-b pb-4 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Sliders className="w-5 h-5 text-slate-400" /> Defina as dimensões da etiqueta e da página</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Altura da etiqueta (cm) *</Label>
                <Input type="number" step="0.01" value={form.labelHeightCm} onChange={(e) => handleFieldChange("labelHeightCm", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Largura da etiqueta (cm) *</Label>
                <Input type="number" step="0.01" value={form.labelWidthCm} onChange={(e) => handleFieldChange("labelWidthCm", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tamanho da página</Label>
                <Select value={form.paperSize} onValueChange={(v) => handleFieldChange("paperSize", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4 – 21,0 X 29,7 cm">A4 – 21,0 X 29,7 cm</SelectItem>
                    <SelectItem value="Letter – 21,6 X 27,9 cm">Letter – 21,6 X 27,9 cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Colunas na página *</Label>
                <Input type="number" value={form.columnsOnPage} onChange={(e) => handleFieldChange("columnsOnPage", parseInt(e.target.value)||0)} />
              </div>
              <div className="space-y-2">
                <Label>Linhas na página *</Label>
                <Input type="number" value={form.rowsOnPage} onChange={(e) => handleFieldChange("rowsOnPage", parseInt(e.target.value)||0)} />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-md font-semibold text-slate-800 mb-4">Ajuste as margens e o espaçamento</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Margem superior (cm) *</Label>
                  <Input type="number" step="0.01" value={form.marginTopCm} onChange={(e) => handleFieldChange("marginTopCm", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Margem lateral (cm) *</Label>
                  <Input type="number" step="0.01" value={form.marginLeftCm} onChange={(e) => handleFieldChange("marginLeftCm", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Densidade vertical (cm) *</Label>
                  <Input type="number" step="0.01" value={form.verticalPitchCm} onChange={(e) => handleFieldChange("verticalPitchCm", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Densidade horizontal (cm) *</Label>
                  <Input type="number" step="0.01" value={form.horizontalPitchCm} onChange={(e) => handleFieldChange("horizontalPitchCm", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Configure a impressão */}
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
            <div className="border-b pb-4 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Settings className="w-5 h-5 text-slate-400" /> Configure a impressão</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição no topo</Label>
                <Input placeholder="Ex: Nome da Loja" value={form.topDescription} onChange={(e) => handleFieldChange("topDescription", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Limite de caracteres do produto</Label>
                <Input type="number" value={form.maxCharsProductName} onChange={(e) => handleFieldChange("maxCharsProductName", parseInt(e.target.value)||0)} />
              </div>
              <div className="space-y-2">
                <Label>Fonte da etiqueta *</Label>
                <Select value={form.fontFamily} onValueChange={(v) => handleFieldChange("fontFamily", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamanho da fonte *</Label>
                <Select value={form.fontSizePt.toString()} onValueChange={(v) => handleFieldChange("fontSizePt", parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 pt</SelectItem>
                    <SelectItem value="6">6 pt</SelectItem>
                    <SelectItem value="7">7 pt</SelectItem>
                    <SelectItem value="8">8 pt</SelectItem>
                    <SelectItem value="9">9 pt</SelectItem>
                    <SelectItem value="10">10 pt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preview and Toggles */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-md font-bold mb-4 text-slate-800">Pré-visualização da folha</h3>
            <div className="flex justify-center bg-slate-50 p-4 rounded-lg border border-dashed border-slate-300">
              <div 
                className="bg-white border shadow-sm relative overflow-hidden" 
                style={{ width: pageWidth * previewScale, height: pageHeight * previewScale }}
              >
                {/* Draw miniature grid */}
                <div style={{
                  position: 'absolute',
                  top: Number(form.marginTopCm) * 10 * previewScale,
                  left: Number(form.marginLeftCm) * 10 * previewScale,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${form.columnsOnPage}, ${Number(form.labelWidthCm) * 10 * previewScale}px)`,
                  gridTemplateRows: `repeat(${form.rowsOnPage}, ${Number(form.labelHeightCm) * 10 * previewScale}px)`,
                  columnGap: `${(Number(form.horizontalPitchCm) - Number(form.labelWidthCm)) * 10 * previewScale}px`,
                  rowGap: `${(Number(form.verticalPitchCm) - Number(form.labelHeightCm)) * 10 * previewScale}px`,
                }}>
                  {Array.from({ length: form.columnsOnPage * form.rowsOnPage }).map((_, i) => (
                    <div key={i} className="bg-slate-200 border border-slate-300 rounded-[1px]" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
            <div className="border-b pb-4 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">Exibir na etiqueta</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="showInternalCode" className="font-medium text-slate-700">Código interno</Label>
                <Switch id="showInternalCode" checked={form.showInternalCode} onCheckedChange={(c) => handleFieldChange("showInternalCode", c)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showBarcode" className="font-medium text-slate-700">Código de barras</Label>
                <Switch id="showBarcode" checked={form.showBarcode} onCheckedChange={(c) => handleFieldChange("showBarcode", c)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showBarcodeDigits" className="font-medium text-slate-700">Número do código de barras</Label>
                <Switch id="showBarcodeDigits" checked={form.showBarcodeDigits} onCheckedChange={(c) => handleFieldChange("showBarcodeDigits", c)} />
              </div>
              
              {form.showBarcode && (
                <div className="space-y-2 pt-2">
                  <Label>Posição do código de barras</Label>
                  <Select value={form.barcodePosition} onValueChange={(v) => handleFieldChange("barcodePosition", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Superior">Superior</SelectItem>
                      <SelectItem value="Inferior">Inferior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <Label htmlFor="showPrice" className="font-medium text-slate-700">Valor do produto</Label>
                <Switch id="showPrice" checked={form.showPrice} onCheckedChange={(c) => handleFieldChange("showPrice", c)} />
              </div>
              
              {form.showPrice && (
                <div className="space-y-2 pt-2">
                  <Label>Tamanho da fonte do valor</Label>
                  <Select value={form.priceFontSize} onValueChange={(v) => handleFieldChange("priceFontSize", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Padrão">Padrão</SelectItem>
                      <SelectItem value="Maior">Maior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-end gap-3 md:pl-[280px]">
        <div className="max-w-[1400px] w-full mx-auto flex justify-end items-center gap-4 px-4 md:px-8">
          <Button 
            variant="outline" 
            onClick={() => router.push('/produtos/etiquetas')}
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
            {isSaving ? "Salvando..." : (templateId ? "Atualizar" : "Cadastrar")}
          </Button>
        </div>
      </div>
    </div>
  );
}
