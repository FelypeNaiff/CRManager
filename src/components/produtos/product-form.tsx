"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Package, Save, X, Info, UploadCloud, RefreshCw, Plus, 
  Edit, FileText, Sliders, Layers, DollarSign, CreditCard, Box, Camera, Image as ImageIcon, Receipt, FileCheck, Building2, Truck, Settings, Trash2, Search
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  getProductCategories,
  getSuppliers,
  createProductCategory,
  createSupplier,
  createProduct,
  createProductVariant,
  updateProduct,
  getProductById
} from "@/lib/crm/products-actions"
import { getProductGrades } from "@/lib/crm/grades-actions"
import { safeNumber } from "@/lib/utils/form-normalizer"

type TabType = "dados" | "detalhes" | "valores" | "estoque" | "fotos" | "fiscal" | "fornecedores";

export default function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!productId)
  const [activeTab, setActiveTab] = useState<TabType>("dados")

  // Estado do formulário
  const [form, setForm] = useState({
    // Dados
    nome: "",
    codigoInterno: "",
    codigoBarras: "",
    grupo: "",
    unidadeMedida: "UN",
    unidadeCompra: "UN",
    unidadeConversao: "1",
    comproEmUmaVendoEmOutra: false,
    movimentaEstoque: "Sim",
    habilitarNotaFiscal: "Sim",
    possuiVariacoes: "Não",
    
    // Detalhes
    produtoAtivo: true,
    vendidoSeparadamente: true,
    comercializavelPdv: true,
    comissaoVendedor: 0,
    peso: 0,
    largura: 0,
    altura: 0,
    comprimento: 0,
    descricao: "",
    camposExtras: [] as { id: string, nome: string, valor: string }[],
    
    // Valores
    custoBase: 0,
    despesasAcessorias: 0,
    outrasDespesas: 0,
    lucroUtilizado: 30,
    valorVenda: 0,
    
    // Estoque s/ variação
    estoqueAtual: 0,
    estoqueMinimo: 0,
    estoqueMaximo: 0,
    
    // Variações
    variacoes: [] as { id: string, codigoInterno: string, codigoBarras: string, grade: string, valorDaGrade: string, estoqueAtual: number }[],
    tiposGradeSelecionados: [] as string[],
    
    // Fiscal
    codBeneficio: "",
    ncm: "",
    cest: "",
    origem: "0",
    pesoLiquido: 0,
    pesoBruto: 0,
    numeroFci: "",
    produtoEspecifico: "Não usar",
    regraImposto: "padrao",
    
    // Fornecedor
    fornecedorId: "",
  })

  const custoFinal = useMemo(() => {
    return Number(form.custoBase) + Number(form.despesasAcessorias) + Number(form.outrasDespesas)
  }, [form.custoBase, form.despesasAcessorias, form.outrasDespesas])

  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [grupos, setGrupos] = useState<any[]>([])
  const [dbGrades, setDbGrades] = useState<any[]>([])

  const loadDependencies = useCallback(async () => {
    try {
      const [catRes, supRes, gradesRes] = await Promise.all([
        getProductCategories(),
        getSuppliers(),
        getProductGrades()
      ]);
      if (catRes.success && catRes.data) {
        setGrupos(catRes.data);
      }
      if (supRes.success && supRes.data) {
        const mappedS = supRes.data.map((s: any) => ({
          id: s.id,
          nome: s.name,
          nomeFornecedor: s.name,
          cnpjFornecedor: s.cnpjCpf,
          emailFornecedor: s.email,
          telefoneFornecedor: s.phone
        }));
        setFornecedores(mappedS);
      }
      if (gradesRes.success && gradesRes.data) {
        setDbGrades(gradesRes.data);
      }
    } catch (error) {
      console.error("Error loading dropdown data:", error);
    }
  }, []);

  const loadProductData = useCallback(async (id: string) => {
    try {
      const res = await getProductById(id);
      if (res.success && res.data) {
        const p = res.data;
        const v = p.variants?.[0]; // Assuming single variant logic for simplicity for now
        
        setForm({
          nome: p.name || "",
          codigoInterno: p.internalCode || "",
          codigoBarras: v?.barcode || "",
          grupo: p.categoryId || "",
          unidadeMedida: p.salesUnit || "UN",
          unidadeCompra: p.purchaseUnit || "UN",
          unidadeConversao: String(p.purchaseFactor || 1),
          comproEmUmaVendoEmOutra: p.salesUnit !== p.purchaseUnit,
          movimentaEstoque: p.trackStock ? "Sim" : "Não",
          habilitarNotaFiscal: "Sim", // default
          possuiVariacoes: p.variants?.length > 1 ? "Sim" : "Não",
          
          produtoAtivo: p.isActive,
          vendidoSeparadamente: true,
          comercializavelPdv: p.pdvEligible,
          comissaoVendedor: Number(p.commissionRate) || 0,
          peso: 0, largura: 0, altura: 0, comprimento: 0,
          descricao: p.description || "",
          camposExtras: [],
          
          custoBase: v ? Number(v.costPrice) : 0,
          despesasAcessorias: 0,
          outrasDespesas: 0,
          lucroUtilizado: v && Number(v.costPrice) > 0 ? ((Number(v.salePrice) / Number(v.costPrice)) - 1) * 100 : 30,
          valorVenda: v ? Number(v.salePrice) : 0,
          
          estoqueAtual: v ? Number(v.currentStock) : 0,
          estoqueMinimo: v ? Number(v.minimumStock) : 0,
          estoqueMaximo: 0,
          
          variacoes: p.variants?.length > 1 ? p.variants.map((va: any) => ({
            id: va.id,
            codigoInterno: va.sku || "",
            codigoBarras: va.barcode || "",
            grade: "Tamanho", // mock
            valorDaGrade: (va.name ? va.name.split(" - ")[1] || va.name : "Único"),
            estoqueAtual: Number(va.currentStock) || 0
          })) : [],
          tiposGradeSelecionados: [],
          
          codBeneficio: "", ncm: p.ncm || "", cest: p.cest || "", origem: p.fiscalOrigin || "0",
          pesoLiquido: 0, pesoBruto: 0, numeroFci: "", produtoEspecifico: "Não usar", regraImposto: "padrao",
          
          fornecedorId: p.supplierId || "",
        });
      } else {
        toast({ title: 'Erro', description: res.error || 'Produto não encontrado.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar produto.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDependencies().then(() => {
      if (productId) {
        loadProductData(productId);
      }
    });
  }, [loadDependencies, productId, loadProductData]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dados do produto...</div>;
  }

  const [isNewGrupoDialogOpen, setIsNewGrupoDialogOpen] = useState(false)
  const [isNewFornecedorDialogOpen, setIsNewFornecedorDialogOpen] = useState(false)
  const [newGrupoName, setNewGrupoName] = useState("")
  const [newFornecedorName, setNewFornecedorName] = useState("")
  const [isCreatingGrupo, setIsCreatingGrupo] = useState(false)
  const [isCreatingFornecedor, setIsCreatingFornecedor] = useState(false)

  const handleFieldChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleLucroChange = (val: string) => {
    handleFieldChange("lucroUtilizado", val)
    const custo = custoFinal;
    const lucro = Number(val);
    const novoVenda = custo * (1 + (lucro / 100));
    handleFieldChange("valorVenda", novoVenda.toFixed(2));
  }

  const handleVendaChange = (val: string) => {
    handleFieldChange("valorVenda", val);
    const custo = custoFinal;
    const venda = Number(val);
    if (custo > 0) {
      const novoLucro = ((venda / custo) - 1) * 100;
      handleFieldChange("lucroUtilizado", novoLucro.toFixed(2));
    } else {
      handleFieldChange("lucroUtilizado", 100);
    }
  }

  const gerarCodigo = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    handleFieldChange("codigoInterno", `PRD-${timestamp}-${random}`)
  }

  const gerarCodigoBarraVariavel = (id: string) => {
    setForm(prev => ({
      ...prev,
      variacoes: prev.variacoes.map(v => v.id === id ? { ...v, codigoBarras: `789${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}` } : v)
    }))
  }

  const addCampoExtra = () => {
    setForm(prev => ({
      ...prev,
      camposExtras: [...prev.camposExtras, { id: Date.now().toString(), nome: "", valor: "" }]
    }))
  }

  const removeCampoExtra = (id: string) => {
    setForm(prev => ({
      ...prev,
      camposExtras: prev.camposExtras.filter(c => c.id !== id)
    }))
  }

  const updateCampoExtra = (id: string, field: 'nome'|'valor', value: string) => {
    setForm(prev => ({
      ...prev,
      camposExtras: prev.camposExtras.map(c => c.id === id ? { ...c, [field]: value } : c)
    }))
  }

  const toggleGrade = (grade: string) => {
    setForm(prev => {
      const selected = prev.tiposGradeSelecionados.includes(grade)
        ? prev.tiposGradeSelecionados.filter(g => g !== grade)
        : [...prev.tiposGradeSelecionados, grade];
      return { ...prev, tiposGradeSelecionados: selected };
    });
  }

  const addVariacao = () => {
    setForm(prev => ({
      ...prev,
      variacoes: [
        ...prev.variacoes, 
        { 
          id: Date.now().toString(), 
          codigoInterno: prev.codigoInterno ? `${prev.codigoInterno}-VAR${prev.variacoes.length+1}` : "", 
          codigoBarras: "", 
          grade: prev.tiposGradeSelecionados[0] || "Tamanho", 
          valorDaGrade: "", 
          estoqueAtual: 0 
        }
      ]
    }))
  }

  const removeVariacao = (id: string) => {
    setForm(prev => ({
      ...prev,
      variacoes: prev.variacoes.filter(v => v.id !== id)
    }))
  }

  const updateVariacao = (id: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      variacoes: prev.variacoes.map(v => v.id === id ? { ...v, [field]: value } : v)
    }))
  }

  const handleCreateNewGrupo = async () => {
    if (!newGrupoName.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
      return
    }
    setIsCreatingGrupo(true)
    try {
      const res = await createProductCategory({ name: newGrupoName, description: "" });
      if (res.success && res.data) {
        handleFieldChange("grupo", res.data.id)
        setNewGrupoName("")
        setIsNewGrupoDialogOpen(false)
        toast({ title: "Grupo criado com sucesso!" })
        await loadDependencies()
      } else {
        toast({ variant: "destructive", title: res.error || "Erro ao criar grupo." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." })
    } finally {
      setIsCreatingGrupo(false)
    }
  }

  const handleCreateNewFornecedor = async () => {
    if (!newFornecedorName.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
      return
    }
    setIsCreatingFornecedor(true)
    try {
      const res = await createSupplier({ name: newFornecedorName });
      if (res.success && res.data) {
        handleFieldChange("fornecedorId", res.data.id)
        setNewFornecedorName("")
        setIsNewFornecedorDialogOpen(false)
        toast({ title: "Fornecedor criado com sucesso!" })
        await loadDependencies()
      } else {
        toast({ variant: "destructive", title: res.error || "Erro ao criar fornecedor." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." })
    } finally {
      setIsCreatingFornecedor(false)
    }
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O nome do produto é obrigatório." })
      setActiveTab("dados")
      return
    }
    if (!form.codigoInterno.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O código interno é obrigatório." })
      setActiveTab("dados")
      return
    }

    setIsSaving(true)
    try {
      if (productId) {
        // Modo Edição
        const updateRes = await updateProduct(productId, {
          name: form.nome,
          internalCode: form.codigoInterno,
          description: form.descricao,
          categoryId: form.grupo || null,
          supplierId: form.fornecedorId || null,
          imageUrl: "",
          thumbnailUrl: "",
          galleryUrls: [],
          costPrice: safeNumber(form.custoBase) ?? 0,
          salePrice: safeNumber(form.valorVenda) ?? 0,
          barcode: form.codigoBarras || null,
          barcodeType: null,
          salesUnit: form.unidadeMedida,
          purchaseUnit: form.comproEmUmaVendoEmOutra ? form.unidadeCompra : form.unidadeMedida,
          purchaseFactor: form.comproEmUmaVendoEmOutra ? safeNumber(form.unidadeConversao) : 1,
          ncm: form.ncm,
          cest: form.cest,
          fiscalOrigin: form.origem,
          trackStock: form.movimentaEstoque === "Sim",
          pdvEligible: form.comercializavelPdv,
          commissionRate: safeNumber(form.comissaoVendedor) ?? null,
          minimumStock: form.possuiVariacoes === "Não" ? safeNumber(form.estoqueMinimo) : 0,
        });

        if (!updateRes.success) {
          toast({ variant: "destructive", title: "Erro ao salvar", description: updateRes.error })
          return
        }

        // Variantes handling omitido por brevidade no sprint, mas deveria estar aqui...
        
        toast({ title: "Sucesso", description: "Produto atualizado com sucesso." })
        router.push("/produtos")
      } else {
        // Modo Criação
        const productRes = await createProduct({
        name: form.nome,
        internalCode: form.codigoInterno,
        description: form.descricao,
        categoryId: form.grupo || null,
        supplierId: form.fornecedorId || null,
        imageUrl: "",
        thumbnailUrl: "",
        galleryUrls: [],
        costPrice: safeNumber(form.custoBase) ?? 0,
        salePrice: safeNumber(form.valorVenda) ?? 0,
        barcode: form.codigoBarras || null,
        barcodeType: null,
        salesUnit: form.unidadeMedida,
        purchaseUnit: form.comproEmUmaVendoEmOutra ? form.unidadeCompra : form.unidadeMedida,
        purchaseFactor: form.comproEmUmaVendoEmOutra ? safeNumber(form.unidadeConversao) : 1,
        ncm: form.ncm,
        cest: form.cest,
        fiscalOrigin: form.origem,
        trackStock: form.movimentaEstoque === "Sim",
        pdvEligible: form.comercializavelPdv,
        commissionRate: safeNumber(form.comissaoVendedor) ?? null,
        minimumStock: form.possuiVariacoes === "Não" ? safeNumber(form.estoqueMinimo) : 0,
      });

      if (!productRes.success || !productRes.data) {
        toast({ variant: "destructive", title: "Erro ao salvar", description: productRes.error || "Erro desconhecido ao criar produto." })
        setIsSaving(false)
        return
      }

      // 2. Cria as variações (se aplicável)
      const productId = productRes.data.id;
      if (form.possuiVariacoes === "Sim" && form.variacoes.length > 0) {
        for (const variacao of form.variacoes) {
          await createProductVariant(productId, {
            name: `${form.nome} - ${variacao.valorDaGrade}`,
            sku: variacao.codigoInterno || `${form.codigoInterno}-${variacao.valorDaGrade}`,
            barcode: variacao.codigoBarras || null,
            costPrice: safeNumber(form.custoBase) ?? 0,
            salePrice: safeNumber(form.valorVenda) ?? 0,
            minimumStock: 0,
          });
        }
      }

      toast({ title: "Sucesso", description: "Produto cadastrado com sucesso." })
      router.push("/produtos")
      } // Fecha else do modo Criação
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsSaving(false)
    }
  }

  const tabsMenu = [
    { id: "dados", title: "Dados", subtitle: "Nome, códigos e configurações", icon: FileText },
    { id: "detalhes", title: "Detalhes", subtitle: "Pesos, dimensões e campos extras", icon: Sliders },
    { id: "valores", title: "Valores", subtitle: "Custo e valores de venda", icon: DollarSign },
    { id: "estoque", title: form.possuiVariacoes === "Sim" ? "Estoque/Variações" : "Estoque", subtitle: form.possuiVariacoes === "Sim" ? "Grades, variações e quantidades" : "Quantidades e limites por loja", icon: Package },
    { id: "fotos", title: "Fotos", subtitle: "Imagens do produto", icon: Camera },
    { id: "fiscal", title: "Fiscal", subtitle: "NCM, CEST, origem e regras", icon: Receipt },
    { id: "fornecedores", title: "Fornecedores", subtitle: "Quem fornece este produto", icon: Building2 },
  ] as const;

  return (
    <div className="bg-[#f8f9fa] min-h-screen pb-20">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Header Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-white rounded-xl shadow-sm border text-slate-700">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{productId ? 'Editar Produto' : 'Novo Produto'}</h1>
            <p className="text-slate-500 text-sm">Cadastre um novo item no sistema.</p>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          
          {/* Left Sidebar Menu */}
          <div className="w-full md:w-[280px] shrink-0 space-y-2">
            {tabsMenu.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left border ${
                    isActive 
                      ? "bg-[#12213a] text-white border-[#12213a] shadow-md shadow-[#12213a]/20" 
                      : "bg-white text-slate-700 hover:bg-slate-50 border-transparent hover:border-slate-200"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isActive ? "bg-white/10" : "bg-slate-100"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{tab.title}</div>
                    <div className={`text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>{tab.subtitle}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 w-full space-y-6">
            
            {/* --- ABA 1: DADOS --- */}
            {activeTab === "dados" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="border-b pb-4 mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Edit className="w-5 h-5 text-slate-400" /> Informe os dados principais do produto</h2>
                    <p className="text-sm text-slate-500 mt-1">Nome, códigos e as opções que definem como o produto se comporta no sistema.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input id="nome" value={form.nome} onChange={(e) => handleFieldChange("nome", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codigoInterno">Código interno *</Label>
                      <div className="flex gap-2">
                        <Input id="codigoInterno" value={form.codigoInterno} onChange={(e) => handleFieldChange("codigoInterno", e.target.value)} />
                        <Button variant="outline" size="icon" onClick={gerarCodigo} title="Gerar código"><RefreshCw className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codigoBarras">Código de barra</Label>
                      <div className="flex gap-2">
                        <Input id="codigoBarras" value={form.codigoBarras} onChange={(e) => handleFieldChange("codigoBarras", e.target.value)} />
                        <Button variant="outline" size="icon" title="Gerar código EAN" onClick={() => handleFieldChange("codigoBarras", `789${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`)}><Layers className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grupo">Grupo do produto</Label>
                      <div className="flex gap-2">
                        <Select value={form.grupo} onValueChange={(v) => handleFieldChange("grupo", v)}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {grupos?.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsNewGrupoDialogOpen(true)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fornecedorId">Fornecedor</Label>
                      <div className="flex gap-2">
                        <Select value={form.fornecedorId} onValueChange={(v) => handleFieldChange("fornecedorId", v)}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {fornecedores?.map(f => <SelectItem key={f.id} value={f.id}>{f.nomeFornecedor || f.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsNewFornecedorDialogOpen(true)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="movimentaEstoque">Movimenta estoque?</Label>
                      <Select value={form.movimentaEstoque} onValueChange={(v) => handleFieldChange("movimentaEstoque", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="habilitarNotaFiscal">Habilitar nota fiscal?</Label>
                      <Select value={form.habilitarNotaFiscal} onValueChange={(v) => handleFieldChange("habilitarNotaFiscal", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="possuiVariacoes">Possui variações?</Label>
                      <Select value={form.possuiVariacoes} onValueChange={(v) => handleFieldChange("possuiVariacoes", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="border-b pb-4 mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Box className="w-5 h-5 text-slate-400" /> Defina a unidade de medida do produto</h2>
                    <p className="text-sm text-slate-500 mt-1">Unidade em que o produto é comprado e vendido...</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="comproEmUmaVendoEmOutra" checked={form.comproEmUmaVendoEmOutra} onCheckedChange={(checked) => handleFieldChange("comproEmUmaVendoEmOutra", checked)} />
                    <Label htmlFor="comproEmUmaVendoEmOutra">Compro em uma unidade e vendo em outra</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="unidadeMedida">Unidade de medida *</Label>
                      <Select value={form.unidadeMedida} onValueChange={(v) => handleFieldChange("unidadeMedida", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UN">Unidade (UN)</SelectItem>
                          <SelectItem value="CX">Caixa (CX)</SelectItem>
                          <SelectItem value="KG">Quilograma (KG)</SelectItem>
                          <SelectItem value="MT">Metro (MT)</SelectItem>
                          <SelectItem value="PAR">Par (PAR)</SelectItem>
                          <SelectItem value="PC">Peça (PC)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.comproEmUmaVendoEmOutra && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="unidadeCompra">Unidade de compra *</Label>
                          <Select value={form.unidadeCompra} onValueChange={(v) => handleFieldChange("unidadeCompra", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UN">Unidade (UN)</SelectItem>
                              <SelectItem value="CX">Caixa (CX)</SelectItem>
                              <SelectItem value="KG">Quilograma (KG)</SelectItem>
                              <SelectItem value="MT">Metro (MT)</SelectItem>
                              <SelectItem value="PAR">Par (PAR)</SelectItem>
                              <SelectItem value="PC">Peça (PC)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unidadeConversao">Fator de conversão (Rende quantos {form.unidadeMedida}?)</Label>
                          <Input id="unidadeConversao" type="number" min="1" value={form.unidadeConversao} onChange={(e) => handleFieldChange("unidadeConversao", e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- ABA 2: DETALHES --- */}
            {activeTab === "detalhes" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Regras */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Sliders className="w-5 h-5 text-slate-400" /> Defina as regras de venda do produto</h2>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-start space-x-3">
                        <Switch id="produtoAtivo" checked={form.produtoAtivo} onCheckedChange={(c) => handleFieldChange("produtoAtivo", c)} />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="produtoAtivo" className="font-semibold text-slate-700">Produto ativo</Label>
                          <p className="text-sm text-slate-500">Inativo, o produto deixa de aparecer nas vendas e buscas.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Switch id="vendidoSeparadamente" checked={form.vendidoSeparadamente} onCheckedChange={(c) => handleFieldChange("vendidoSeparadamente", c)} />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="vendidoSeparadamente" className="font-semibold text-slate-700">Vendido separadamente</Label>
                          <p className="text-sm text-slate-500">Pode ser vendido sozinho, e não só como parte de uma composição.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Switch id="comercializavelPdv" checked={form.comercializavelPdv} onCheckedChange={(c) => handleFieldChange("comercializavelPdv", c)} />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="comercializavelPdv" className="font-semibold text-slate-700">Comercializável no PDV</Label>
                          <p className="text-sm text-slate-500">Aparece no PDV para venda no balcão.</p>
                        </div>
                      </div>
                      <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="comissaoVendedor">Comissão do vendedor (%)</Label>
                        <div className="relative">
                          <Input id="comissaoVendedor" type="number" step="0.01" value={form.comissaoVendedor} onChange={(e) => handleFieldChange("comissaoVendedor", e.target.value)} className="pr-10" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dimensões */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Box className="w-5 h-5 text-slate-400" /> Informe pesos e dimensões</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Peso</Label>
                        <div className="relative">
                          <Input type="number" step="0.001" value={form.peso} onChange={(e) => handleFieldChange("peso", e.target.value)} className="pr-10" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">kg</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Largura</Label>
                        <div className="relative">
                          <Input type="number" step="0.01" value={form.largura} onChange={(e) => handleFieldChange("largura", e.target.value)} className="pr-10" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">m</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Altura</Label>
                        <div className="relative">
                          <Input type="number" step="0.01" value={form.altura} onChange={(e) => handleFieldChange("altura", e.target.value)} className="pr-10" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">m</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Comprimento</Label>
                        <div className="relative">
                          <Input type="number" step="0.01" value={form.comprimento} onChange={(e) => handleFieldChange("comprimento", e.target.value)} className="pr-10" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">m</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="border-b pb-4 mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><FileText className="w-5 h-5 text-slate-400" /> Escreva a descrição do produto</h2>
                  </div>
                  <Textarea 
                    placeholder="Ex.: Camiseta 100% algodão, corte regular, estampa serigrafada..." 
                    className="min-h-[120px] resize-y"
                    value={form.descricao}
                    onChange={(e) => handleFieldChange("descricao", e.target.value)}
                  />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="border-b pb-4 mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Layers className="w-5 h-5 text-slate-400" /> Adicione campos extras ao produto</h2>
                  </div>
                  
                  {form.camposExtras.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {form.camposExtras.map((campo, index) => (
                        <div key={campo.id} className="flex gap-4 items-end">
                          <div className="space-y-2 flex-1">
                            <Label>Nome do campo</Label>
                            <Input placeholder="Ex: Marca" value={campo.nome} onChange={(e) => updateCampoExtra(campo.id, 'nome', e.target.value)} />
                          </div>
                          <div className="space-y-2 flex-1">
                            <Label>Valor do campo</Label>
                            <Input placeholder="Ex: Nike" value={campo.valor} onChange={(e) => updateCampoExtra(campo.id, 'valor', e.target.value)} />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeCampoExtra(campo.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" onClick={addCampoExtra} className="border-dashed w-full py-8 text-slate-500 hover:text-slate-700 hover:border-slate-400">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar campo extra
                  </Button>
                </div>
              </div>
            )}

            {/* --- ABA 3: VALORES --- */}
            {activeTab === "valores" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Custo */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><CreditCard className="w-5 h-5 text-slate-400" /> Custo do produto</h2>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Valor de custo * (R$)</Label>
                        <Input type="number" step="0.01" value={form.custoBase} onChange={(e) => handleFieldChange("custoBase", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Despesas acessórias (R$)</Label>
                        <Input type="number" step="0.01" value={form.despesasAcessorias} onChange={(e) => handleFieldChange("despesasAcessorias", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Outras despesas (R$)</Label>
                        <Input type="number" step="0.01" value={form.outrasDespesas} onChange={(e) => handleFieldChange("outrasDespesas", e.target.value)} />
                      </div>
                      <div className="pt-4 border-t space-y-2">
                        <Label className="text-slate-500">Custo final * (R$)</Label>
                        <div className="text-2xl font-black text-slate-800">R$ {custoFinal.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Venda */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><DollarSign className="w-5 h-5 text-slate-400" /> Defina os valores de venda do produto</h2>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
                      <Info className="w-5 h-5 text-blue-500 shrink-0" />
                      Você pode definir diferentes regras de preço. Ao preencher a Margem ou o Markup, o sistema calcula o Valor automaticamente.
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Lucro sugerido (%)</Label>
                          <Input value="30" disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Lucro utilizado (%)</Label>
                          <Input type="number" step="0.01" value={form.lucroUtilizado} onChange={(e) => handleLucroChange(e.target.value)} />
                        </div>
                      </div>
                      <div className="pt-2">
                        <Label className="text-lg font-bold text-emerald-700">Valor de Venda (R$)</Label>
                        <Input type="number" step="0.01" className="text-2xl h-12 font-bold text-emerald-700 border-emerald-300 focus-visible:ring-emerald-500" value={form.valorVenda} onChange={(e) => handleVendaChange(e.target.value)} />
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700">Tipo</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Lucro Util. (%)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Valor (R$)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 text-center">Situação</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="px-4 py-3 font-medium">Varejo</td>
                            <td className="px-4 py-3">{Number(form.lucroUtilizado).toFixed(2)}%</td>
                            <td className="px-4 py-3 font-bold">R$ {Number(form.valorVenda).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">Ativo</span></td>
                            <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon"><Settings className="w-4 h-4 text-slate-400" /></Button></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">Calcular valor de venda</Button>
                      <Button variant="outline" className="flex-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50">+ Novo valor de venda</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- ABA 4: ESTOQUE / VARIAÇÕES --- */}
            {activeTab === "estoque" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                
                {form.possuiVariacoes === "Não" ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Package className="w-5 h-5 text-slate-400" /> Informe o estoque do produto</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Estoque mínimo</Label>
                        <div className="relative">
                          <Input type="number" value={form.estoqueMinimo} onChange={(e) => handleFieldChange("estoqueMinimo", e.target.value)} className="pr-12" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{form.unidadeMedida}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Estoque máximo</Label>
                        <div className="relative">
                          <Input type="number" value={form.estoqueMaximo} onChange={(e) => handleFieldChange("estoqueMaximo", e.target.value)} className="pr-12" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{form.unidadeMedida}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade atual</Label>
                        <div className="relative">
                          <Input type="number" disabled value={form.estoqueAtual} onChange={(e) => handleFieldChange("estoqueAtual", e.target.value)} className="pr-12" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{form.unidadeMedida}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Layers className="w-5 h-5 text-slate-400" /> Monte as variações do produto</h2>
                      <p className="text-sm text-slate-500 mt-1">Marque os tipos de grade que o produto tem e cadastre cada combinação com seu código e estoque.</p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Tipos de grade</Label>
                      <div className="flex flex-wrap gap-2">
                        {dbGrades.length === 0 ? (
                           <span className="text-sm text-slate-500 italic">Nenhuma grade cadastrada. Adicione grades no menu "Grades e Variações".</span>
                        ) : (
                          dbGrades.map((grade: any) => {
                            const isActive = form.tiposGradeSelecionados.includes(grade.name);
                            return (
                              <button
                                key={grade.id}
                                type="button"
                                onClick={() => toggleGrade(grade.name)}
                                className={`px-4 py-2 rounded-full border text-sm transition-colors ${isActive ? 'bg-[#12213a] border-[#12213a] text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                              >
                                {grade.name}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {form.tiposGradeSelecionados.length > 0 && (
                      <div className="pt-6">
                        <div className="border rounded-lg overflow-x-auto">
                          <table className="w-full text-sm text-left min-w-[700px]">
                            <thead className="bg-slate-50 border-b">
                              <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700 min-w-[150px]">Cód interno</th>
                                <th className="px-4 py-3 font-semibold text-slate-700 min-w-[200px]">Cód barra</th>
                                {form.tiposGradeSelecionados.map(grade => (
                                  <th key={grade} className="px-4 py-3 font-semibold text-slate-700">{grade}</th>
                                ))}
                                <th className="px-4 py-3 font-semibold text-slate-700 w-32">Estoque atual</th>
                                <th className="px-4 py-3 w-16"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.variacoes.length === 0 && (
                                <tr>
                                  <td colSpan={5 + form.tiposGradeSelecionados.length} className="p-8 text-center text-slate-500">
                                    Nenhuma variação adicionada. Clique em "+ Nova variação" abaixo.
                                  </td>
                                </tr>
                              )}
                              {form.variacoes.map((v, idx) => (
                                <tr key={v.id} className="bg-white border-b last:border-0 hover:bg-slate-50/50">
                                  <td className="p-2"><Input value={v.codigoInterno} onChange={(e) => updateVariacao(v.id, 'codigoInterno', e.target.value)} className="h-8" /></td>
                                  <td className="p-2">
                                    <div className="flex gap-1">
                                      <Input value={v.codigoBarras} onChange={(e) => updateVariacao(v.id, 'codigoBarras', e.target.value)} className="h-8" />
                                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => gerarCodigoBarraVariavel(v.id)} title="Gerar Cód Barras"><Layers className="h-4 w-4" /></Button>
                                    </div>
                                  </td>
                                  {form.tiposGradeSelecionados.map((gradeName, gIdx) => {
                                    const gradeDetails = dbGrades.find((g: any) => g.name === gradeName);
                                    return (
                                      <td key={gradeName} className="p-2">
                                        {gIdx === 0 ? (
                                          <Select 
                                            value={v.valorDaGrade} 
                                            onValueChange={(val) => updateVariacao(v.id, 'valorDaGrade', val)}
                                          >
                                            <SelectTrigger className="h-8">
                                              <SelectValue placeholder={gradeName} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {gradeDetails?.options?.map((opt: any) => (
                                                <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <Input disabled placeholder={gradeName} className="h-8 bg-slate-50" />
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="p-2"><Input type="number" disabled value={v.estoqueAtual} className="h-8 w-24 bg-slate-50 text-center" /></td>
                                  <td className="p-2 text-center">
                                    <Button variant="ghost" size="icon" onClick={() => removeVariacao(v.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" onClick={addVariacao} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <Plus className="w-4 h-4 mr-2" /> Nova variação
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- ABA 5: FOTOS --- */}
            {activeTab === "fotos" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b pb-4 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Camera className="w-5 h-5 text-slate-400" /> Imagens do produto</h2>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer min-h-[300px]">
                  <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <ImageIcon className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">Arraste e solte as imagens aqui</h3>
                  <p className="text-sm text-slate-500 mb-6">Suporte para JPG, PNG ou WebP. Máximo 5MB por foto.</p>
                  <Button variant="secondary" className="bg-white border text-slate-700 hover:bg-slate-50">Selecionar imagens</Button>
                </div>
              </div>
            )}

            {/* --- ABA 6: FISCAL --- */}
            {activeTab === "fiscal" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b pb-4 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Receipt className="w-5 h-5 text-slate-400" /> Informações fiscais</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2 md:col-span-1">
                    <Label>Cód. benefício</Label>
                    <Input value={form.codBeneficio} onChange={(e) => handleFieldChange("codBeneficio", e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>NCM *</Label>
                    <div className="flex gap-2">
                      <Input placeholder="0000.00.00" value={form.ncm} onChange={(e) => handleFieldChange("ncm", e.target.value)} />
                      <Button variant="outline" size="icon"><Search className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>CEST</Label>
                    <Input placeholder="00.000.00" value={form.cest} onChange={(e) => handleFieldChange("cest", e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <Label>Origem *</Label>
                    <Select value={form.origem} onValueChange={(v) => handleFieldChange("origem", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - Nacional, exceto as indicadas nos códigos 3 a 5</SelectItem>
                        <SelectItem value="1">1 - Estrangeira - Importação direta</SelectItem>
                        <SelectItem value="2">2 - Estrangeira - Adquirida no mercado interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Peso líquido (kg)</Label>
                    <Input type="number" step="0.001" value={form.pesoLiquido} onChange={(e) => handleFieldChange("pesoLiquido", e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Peso bruto (kg)</Label>
                    <Input type="number" step="0.001" value={form.pesoBruto} onChange={(e) => handleFieldChange("pesoBruto", e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Número FCI</Label>
                    <Input value={form.numeroFci} onChange={(e) => handleFieldChange("numeroFci", e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Produto específico</Label>
                    <Select value={form.produtoEspecifico} onValueChange={(v) => handleFieldChange("produtoEspecifico", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não usar">Não usar</SelectItem>
                        <SelectItem value="Medicamento">Medicamento</SelectItem>
                        <SelectItem value="Combustível">Combustível</SelectItem>
                        <SelectItem value="Veículo">Veículo</SelectItem>
                        <SelectItem value="Armamento">Armamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t space-y-4">
                  <h3 className="font-semibold text-slate-700">Regras fiscais do produto</h3>
                  <div className="flex gap-4 items-center">
                    <Button variant="outline" className="border-dashed"><Plus className="w-4 h-4 mr-2" /> Adicionar regra de imposto</Button>
                  </div>
                </div>
              </div>
            )}

            {/* --- ABA 7: FORNECEDORES --- */}
            {activeTab === "fornecedores" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b pb-4 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Building2 className="w-5 h-5 text-slate-400" /> Quem fornece este produto</h2>
                  <p className="text-sm text-slate-500 mt-1">Vincule os fornecedores que disponibilizam este item para você.</p>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Truck className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="text-slate-600 font-medium">Você já vinculou este produto na aba "Dados".</div>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">Para vincular mais de um fornecedor para o mesmo produto com códigos distintos, utilize a tela de Compras.</p>
                </div>
              </div>
            )}
            
          </div>
        </div>

        {/* Action Bar Inferior */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-end gap-3 md:pl-[280px]">
          <div className="max-w-[1400px] w-full mx-auto flex justify-between items-center px-4 md:px-8">
             <Button 
              variant="outline" 
              onClick={() => router.back()}
              className="border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors bg-white font-semibold shadow-sm"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-[#12213a] hover:bg-[#0a1424] text-white shadow-md font-semibold px-8"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Salvando..." : (productId ? "Atualizar" : "Cadastrar")}
            </Button>
          </div>
        </div>

      </div>

      {/* Dialogs de Criação */}
      <Dialog open={isNewGrupoDialogOpen} onOpenChange={setIsNewGrupoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Grupo de Produtos</DialogTitle>
            <DialogDescription>Crie um novo grupo para categorizar seus produtos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newGrupoName">Nome do Grupo *</Label>
              <Input id="newGrupoName" value={newGrupoName} onChange={(e) => setNewGrupoName(e.target.value)} placeholder="Ex: Roupas, Calçados" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNewGrupoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateNewGrupo} disabled={isCreatingGrupo} className="bg-[#12213a] text-white hover:bg-[#0a1424]">
                {isCreatingGrupo ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewFornecedorDialogOpen} onOpenChange={setIsNewFornecedorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>Cadastre um fornecedor rapidamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newFornecedorName">Nome do Fornecedor *</Label>
              <Input id="newFornecedorName" value={newFornecedorName} onChange={(e) => setNewFornecedorName(e.target.value)} placeholder="Ex: Distribuidora Silva" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setIsNewFornecedorDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateNewFornecedor} disabled={isCreatingFornecedor} className="bg-[#12213a] text-white hover:bg-[#0a1424]">
                {isCreatingFornecedor ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
