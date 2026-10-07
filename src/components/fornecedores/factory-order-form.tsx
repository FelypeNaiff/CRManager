"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Printer, CheckCircle, Factory, Plus, Trash2, Edit, X, Save, Percent, Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { createFactoryOrder, updateFactoryOrder, FactoryOrderInput } from "@/lib/crm/factory-orders-actions";
import { getSuppliers } from "@/lib/crm/supplier-actions";

type FactoryOrderFormProps = {
  initialData?: any;
};

type OrderItem = {
  id: string; // pseudo-id
  partCode: string;
  reference: string;
  sizes: string[];
  quantity: number;
  unitPrice: number;
  notes: string;
};

const defaultSizesInfantil = ["2", "3", "4", "6", "8", "10", "12", "14", "16", "18"];
const defaultSizesBaby = ["RN", "P", "M", "G", "GG"];

export function FactoryOrderForm({ initialData }: FactoryOrderFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Order State
  const [supplierId, setSupplierId] = useState<string>(initialData?.supplierId || "");
  const [factoryName, setFactoryName] = useState<string>(initialData?.factoryName || "");
  const [commercialDiscount, setCommercialDiscount] = useState<number>(Number(initialData?.commercialDiscount) || 0);
  const [applySuframa, setApplySuframa] = useState<boolean>(initialData?.applySuframa || false);
  const [suframaDiscount, setSuframaDiscount] = useState<number>(Number(initialData?.suframaDiscount) || 16.25);
  const [operatorName, setOperatorName] = useState<string>(initialData?.operatorName || "Admin");
  
  const [items, setItems] = useState<OrderItem[]>(
    initialData?.items?.map((i: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      partCode: i.partCode,
      reference: i.reference,
      sizes: i.sizes,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      notes: i.notes || ""
    })) || []
  );

  // Modal Item State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<OrderItem>({
    id: "", partCode: "", reference: "", sizes: [], quantity: 1, unitPrice: 0, notes: ""
  });
  const [customSize, setCustomSize] = useState("");

  // Print Modals
  const [printType, setPrintType] = useState<"REPRESENTATIVE" | "SUFRAMA" | null>(null);

  useEffect(() => {
    async function loadSuppliers() {
      const res = await getSuppliers({ pageSize: 100 });
      if (res.success && res.data) {
        setSuppliers(res.data);
      }
    }
    loadSuppliers();
  }, []);

  const handleOpenItemModal = (item?: OrderItem) => {
    if (item) {
      setEditingItemId(item.id);
      setItemForm({ ...item });
    } else {
      setEditingItemId(null);
      setItemForm({ id: Math.random().toString(36).substr(2, 9), partCode: "", reference: "", sizes: [], quantity: 1, unitPrice: 0, notes: "" });
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!itemForm.partCode || !itemForm.reference || itemForm.sizes.length === 0 || itemForm.unitPrice <= 0) {
      return toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios." });
    }
    
    // Auto calculate qty based on sizes selected? 
    // Wait, the UI shows 'quantity' input per piece or global? The requirement says "A quantidade total da peça é calculada pela quantidade de tamanhos selecionados (ou campo quantidade específica por tamanho)."
    // Let's assume the user explicitly typed quantity in the input.

    if (editingItemId) {
      setItems(prev => prev.map(i => i.id === editingItemId ? itemForm : i));
    } else {
      setItems(prev => [...prev, itemForm]);
    }
    setIsItemModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleSize = (size: string) => {
    setItemForm(prev => {
      const exists = prev.sizes.includes(size);
      const newSizes = exists ? prev.sizes.filter(s => s !== size) : [...prev.sizes, size];
      // Automatically update qty based on number of sizes if desired, but user can override.
      return { ...prev, sizes: newSizes, quantity: newSizes.length || 1 };
    });
  };

  const handleAddCustomSize = () => {
    if (customSize.trim() && !itemForm.sizes.includes(customSize.trim())) {
      toggleSize(customSize.trim());
      setCustomSize("");
    }
  };

  const onSubmit = async () => {
    if (!factoryName) return toast({ variant: "destructive", title: "Nome da fábrica obrigatório." });
    if (items.length === 0) return toast({ variant: "destructive", title: "Adicione ao menos um item." });

    setLoading(true);
    try {
      const payload: FactoryOrderInput = {
        supplierId: supplierId || undefined,
        factoryName,
        commercialDiscount,
        applySuframa,
        suframaDiscount,
        status: "draft",
        operatorName,
        items: items.map(i => ({
          partCode: i.partCode,
          reference: i.reference,
          sizes: i.sizes,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          notes: i.notes
        }))
      };

      const res = isEditing ? await updateFactoryOrder(initialData.id, payload) : await createFactoryOrder(payload);

      if (res.success) {
        toast({ title: "Sucesso!", description: `Pedido salvo com sucesso.` });
        router.push("/fornecedores/pedidos-fabrica");
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalPieces = items.reduce((acc, i) => acc + i.quantity, 0);
  const totalGross = items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  const totalCommDesc = totalGross * (commercialDiscount / 100);
  const totalAfterComm = totalGross - totalCommDesc;
  const suframaVal = applySuframa ? (totalAfterComm * (suframaDiscount / 100)) : 0;
  const totalNet = totalAfterComm - suframaVal;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 print:m-0 print:p-0 print:bg-white print:max-w-none">
      
      {/* HEADER NO-PRINT */}
      <div className="flex items-center justify-between border-b pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/fornecedores/pedidos-fabrica")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Lançamento de Pedido</div>
            <h1 className="text-2xl font-bold font-headline text-slate-800">
              {isEditing ? `FÁBRICA: ${factoryName}` : "NOVO PEDIDO DE FÁBRICA"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-slate-600 border-slate-300 font-bold" onClick={() => setPrintType("REPRESENTATIVE")}>
            <Printer className="h-4 w-4 mr-2" /> MODELO REPRESENTANTE
          </Button>
          <Button variant="outline" className="text-[#059669] border-[#059669] hover:bg-[#d1fae5] font-bold" onClick={() => { setApplySuframa(true); setPrintType("SUFRAMA"); }}>
            <Percent className="h-4 w-4 mr-2" /> MODELO LOJA (SUFRAMA)
          </Button>
          <Button className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold" onClick={onSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            SALVAR PEDIDO
          </Button>
        </div>
      </div>

      {/* SETTINGS CARD NO-PRINT */}
      <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col md:flex-row gap-6 print:hidden">
        <div className="flex-1 space-y-2">
          <Label className="font-bold text-slate-700">NOME DA FÁBRICA / FORNECEDOR *</Label>
          <div className="flex gap-2">
            <Select value={supplierId} onValueChange={(v) => {
              setSupplierId(v);
              const sup = suppliers.find(s => s.id === v);
              if (sup) setFactoryName(sup.name);
            }}>
              <SelectTrigger className="w-1/2 h-12 font-bold"><SelectValue placeholder="Selecione um fornecedor..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input 
              value={factoryName} onChange={e => setFactoryName(e.target.value)} 
              placeholder="Ou digite o nome livremente" className="w-1/2 h-12 font-bold uppercase" 
            />
          </div>
        </div>

        <div className="w-px bg-slate-200 hidden md:block"></div>

        <div className="flex-1 flex gap-6">
          <div className="space-y-2 flex-1">
            <Label className="font-bold text-slate-700">DESCONTO COMERCIAL (%)</Label>
            <Input type="number" step="0.01" value={commercialDiscount} onChange={e => setCommercialDiscount(Number(e.target.value))} className="h-12 font-bold text-xl text-purple-700" />
          </div>
          <div className="space-y-2 flex-1 bg-green-50 p-3 rounded-lg border border-green-100 relative">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-bold text-green-800">DESCONTO SUFRAMA</Label>
              <Switch checked={applySuframa} onCheckedChange={setApplySuframa} />
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.01" value={suframaDiscount} onChange={e => setSuframaDiscount(Number(e.target.value))} disabled={!applySuframa} className="h-10 font-bold bg-white" />
              <span className="font-bold text-green-700">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ITEMS CARD NO-PRINT */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <div className="font-bold text-slate-800 flex items-center gap-2">
            ITENS DO PEDIDO <Badge className="bg-[#4f46e5]">{items.length}</Badge>
          </div>
          <Button className="bg-[#1e2229] hover:bg-black text-white h-9" onClick={() => handleOpenItemModal()}>
            <Plus className="h-4 w-4 mr-2" /> ADICIONAR PEÇA
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Cód Da Peça</th>
                <th className="px-4 py-3">Referência / Cor</th>
                <th className="px-4 py-3">Tamanhos</th>
                <th className="px-4 py-3 text-center">Qtd</th>
                <th className="px-4 py-3 text-right">Pr. Unitário</th>
                <th className="px-4 py-3 text-right">Pr. C/ Desc Com.</th>
                <th className="px-4 py-3 text-right">Pr. C/ Suframa</th>
                <th className="px-4 py-3 text-right">Total Geral</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Nenhuma peça adicionada.</td></tr>
              ) : items.map(item => {
                const uP = item.unitPrice;
                const cP = uP * (1 - commercialDiscount/100);
                const sP = applySuframa ? cP * (1 - suframaDiscount/100) : cP;
                const tP = sP * item.quantity;
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold">{item.partCode}</td>
                    <td className="px-4 py-3 text-slate-600">{item.reference}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap w-40">
                        {item.sizes.map(s => <Badge key={s} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 px-1.5 rounded-sm">{s}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-lg">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-500">R$ {uP.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-700">R$ {cP.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">R$ {sP.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-800">R$ {tP.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate">{item.notes}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => handleOpenItemModal(item)}><Edit className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4"/></Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-100 p-4 border-t flex justify-end gap-8">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-500">TOTAL DE PEÇAS</div>
            <div className="text-xl font-black">{totalPieces} un</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-slate-500">VALOR BRUTO</div>
            <div className="text-xl font-bold text-slate-600">R$ {totalGross.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-purple-700">VALOR LÍQUIDO</div>
            <div className="text-2xl font-black text-slate-800">R$ {totalNet.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* MODAL: NEW ITEM NO-PRINT */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden print:hidden">
          <DialogHeader className="p-6 pb-0 border-b bg-slate-50">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 mb-4">
              <div className="bg-[#4f46e5] p-2 rounded text-white"><Factory className="h-5 w-5" /></div>
              {editingItemId ? "EDITAR PEÇA" : "NOVA PEÇA DO PEDIDO"}
            </DialogTitle>
            <p className="text-slate-500 text-sm pb-4">Preencha os dados do produto e selecione os tamanhos desejados.</p>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">CÓDIGO DA PEÇA *</Label>
                <Input value={itemForm.partCode} onChange={e => setItemForm(p => ({...p, partCode: e.target.value}))} placeholder="Ex: 8027" className="h-11 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">REFERÊNCIA / COR *</Label>
                <Input value={itemForm.reference} onChange={e => setItemForm(p => ({...p, reference: e.target.value}))} placeholder="Ex: VERMELHO" className="h-11 font-bold uppercase" />
              </div>
            </div>

            <div className="space-y-4 border p-4 rounded-xl bg-slate-50">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-700">TAMANHO(S) DISPONÍVEIS *</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="marcar-var" />
                  <Label htmlFor="marcar-var" className="text-xs font-bold text-slate-500 cursor-pointer">MARCAR VARIÁVEL</Label>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-400 mb-2">INFANTIL / JUVENIL</div>
                <div className="flex flex-wrap gap-2">
                  {defaultSizesInfantil.map(s => (
                    <div 
                      key={s} 
                      onClick={() => toggleSize(s)}
                      className={`h-10 w-10 flex items-center justify-center rounded-full border-2 font-bold cursor-pointer transition-colors ${itemForm.sizes.includes(s) ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-[#4f46e5]'}`}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-400 mb-2">BEBÊ</div>
                <div className="flex flex-wrap gap-2">
                  {defaultSizesBaby.map(s => (
                    <div 
                      key={s} 
                      onClick={() => toggleSize(s)}
                      className={`h-10 w-12 flex items-center justify-center rounded-full border-2 font-bold cursor-pointer transition-colors ${itemForm.sizes.includes(s) ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-[#4f46e5]'}`}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-end gap-2">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs font-bold text-slate-400">OUTRO TAMANHO</Label>
                  <Input value={customSize} onChange={e => setCustomSize(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCustomSize()} placeholder="Ex: ÚNICO" className="h-9 uppercase" />
                </div>
                <Button variant="outline" size="sm" onClick={handleAddCustomSize} className="h-9 font-bold"><Plus className="h-4 w-4 mr-1"/> Adicionar</Button>
              </div>

              {/* Extras selected */}
              {itemForm.sizes.filter(s => !defaultSizesInfantil.includes(s) && !defaultSizesBaby.includes(s)).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t mt-2">
                  {itemForm.sizes.filter(s => !defaultSizesInfantil.includes(s) && !defaultSizesBaby.includes(s)).map(s => (
                    <Badge key={s} className="bg-[#4f46e5] px-3 py-1 cursor-pointer hover:bg-red-500" onClick={() => toggleSize(s)}>
                      {s} <X className="h-3 w-3 ml-2" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">QTD PEÇAS *</Label>
                <Input type="number" value={itemForm.quantity || ""} onChange={e => setItemForm(p => ({...p, quantity: Number(e.target.value)}))} className="h-11 font-black text-xl text-center" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">PREÇO UNITÁRIO (R$) *</Label>
                <Input type="number" step="0.01" value={itemForm.unitPrice || ""} onChange={e => setItemForm(p => ({...p, unitPrice: Number(e.target.value)}))} className="h-11 font-black text-xl text-right" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">OBSERVAÇÃO</Label>
                <Input value={itemForm.notes} onChange={e => setItemForm(p => ({...p, notes: e.target.value}))} placeholder="Opcional" className="h-11" />
              </div>
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
            <Button className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold" onClick={handleSaveItem}>
              <CheckCircle className="h-4 w-4 mr-2" /> SALVAR PEÇA
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL / VIEW: PRINT (Shown on screen as a modal or full div for print) */}
      <Dialog open={printType !== null} onOpenChange={(open) => !open && setPrintType(null)}>
        <DialogContent className="max-w-[1000px] p-0 overflow-hidden bg-white max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:shadow-none print:border-none">
          
          <div className="p-4 bg-slate-100 flex justify-between items-center border-b print:hidden sticky top-0 z-50">
            <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Printer className="h-5 w-5" />
              VISUALIZAÇÃO DE IMPRESSÃO
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPrintType(null)}>Fechar</Button>
              <Button className="bg-[#059669] hover:bg-[#047857] text-white font-bold" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> ABRIR JANELA DE IMPRESSÃO
              </Button>
            </div>
          </div>

          {/* PRINTABLE AREA */}
          <div className="p-10 print:p-0 bg-white space-y-6 text-black" id="print-area">
            
            <div className="flex justify-between items-start border-b-2 border-black pb-4">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">TRUPE KIDS - ROUPAS INFANTIS</h1>
                <div className="text-sm font-semibold">CNPJ: 00.000.000/0001-00 | SÃO JOSÉ DOS PINHAIS - PR</div>
              </div>
              <div className="text-right">
                <Badge className="bg-black text-white rounded-sm mb-2 text-sm font-bold py-1 px-3">
                  {printType === "REPRESENTATIVE" ? "VIA REPRESENTANTE" : "VIA LOJA (COM SUFRAMA)"}
                </Badge>
                <div className="text-sm font-bold">DATA: {new Date().toLocaleDateString('pt-BR')}</div>
                <div className="text-sm font-bold">PEDIDO: {initialData?.orderNumber || "RASCUNHO"}</div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-gray-100 p-4 border border-black font-bold uppercase">
              <div className="text-lg">FÁBRICA / FORNECEDOR: <span className="font-black text-xl">{factoryName || "NÃO INFORMADA"}</span></div>
              <div className="text-lg">SOLICITANTE: <span className="font-black">{operatorName}</span></div>
            </div>

            <table className="w-full text-left text-sm border-collapse border border-black">
              <thead className="bg-gray-200 uppercase font-black text-xs">
                <tr>
                  <th className="border border-black p-2">CÓD PEÇA</th>
                  <th className="border border-black p-2">REFERÊNCIA</th>
                  <th className="border border-black p-2 w-48">TAMANHOS</th>
                  <th className="border border-black p-2 text-center">QTD</th>
                  <th className="border border-black p-2 text-right">PR. UNIT.</th>
                  <th className="border border-black p-2 text-right">PR. C/ DESC. COM.</th>
                  {printType === "SUFRAMA" && <th className="border border-black p-2 text-right">PR. C/ SUFRAMA</th>}
                  <th className="border border-black p-2 text-right">TOTAL FINAL</th>
                </tr>
              </thead>
              <tbody className="font-semibold text-xs">
                {items.map(item => {
                  const uP = item.unitPrice;
                  const cP = uP * (1 - commercialDiscount/100);
                  const sP = applySuframa ? cP * (1 - suframaDiscount/100) : cP;
                  const activePrice = printType === "SUFRAMA" ? sP : cP;
                  const tP = activePrice * item.quantity;
                  return (
                    <tr key={item.id}>
                      <td className="border border-black p-2">{item.partCode}</td>
                      <td className="border border-black p-2">{item.reference}</td>
                      <td className="border border-black p-2">{item.sizes.join(" / ")}</td>
                      <td className="border border-black p-2 text-center text-base font-black">{item.quantity}</td>
                      <td className="border border-black p-2 text-right">R$ {uP.toFixed(2)}</td>
                      <td className="border border-black p-2 text-right">R$ {cP.toFixed(2)}</td>
                      {printType === "SUFRAMA" && <td className="border border-black p-2 text-right">R$ {sP.toFixed(2)}</td>}
                      <td className="border border-black p-2 text-right text-base font-black">R$ {tP.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="flex justify-end pt-4">
              <div className="w-96 border border-black p-4 space-y-2 uppercase font-bold text-sm bg-gray-50">
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span>TOTAL DE ITENS: {items.length}</span>
                  <span>TOTAL DE PEÇAS: {totalPieces}</span>
                </div>
                <div className="flex justify-between text-gray-600 pt-2">
                  <span>VALOR BRUTO:</span>
                  <span>R$ {totalGross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>DESC. COMERCIAL ({commercialDiscount}%):</span>
                  <span>- R$ {totalCommDesc.toFixed(2)}</span>
                </div>
                {printType === "SUFRAMA" && (
                  <div className="flex justify-between text-gray-600">
                    <span>DESC. SUFRAMA ({suframaDiscount}%):</span>
                    <span>- R$ {suframaVal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black pt-2 border-t border-black mt-2">
                  <span>VALOR TOTAL LÍQUIDO:</span>
                  <span>R$ {(printType === "SUFRAMA" ? totalNet : totalAfterComm).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-20 flex justify-between px-10">
              <div className="text-center w-64">
                <div className="border-t border-black pt-2 font-bold uppercase text-sm">ASSINATURA DO REPRESENTANTE / FÁBRICA</div>
              </div>
              <div className="text-center w-64">
                <div className="border-t border-black pt-2 font-bold uppercase text-sm">CONFERÊNCIA DA LOJA (TRUPE KIDS)</div>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
