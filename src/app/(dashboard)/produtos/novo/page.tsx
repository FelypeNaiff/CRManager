"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Package, Save, X, Info, UploadCloud, RefreshCw, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  getProductCategories,
  getSuppliers,
  getProductVariants,
  createProductCategory,
  createSupplier,
  createProduct
} from "@/lib/crm/products-actions"
import { safeNumber } from "@/lib/utils/form-normalizer"

export default function NãovoProdutoPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  // Estado do formulário
  const [form, setForm] = useState({
    // Dados
    nome: "",
    codigoInterno: "",
    codigoBarras: "",
    grupo: "",
    unidadeMedida: "UN",
    unidadeConversao: "1",
    
    // Valores
    custoBase: 0,
    despesasAcessorias: 0,
    outrasDespesas: 0,
    lucroUtilizado: 0,
    valorVenda: 0,
    
    // Fornecedor
    fornecedorId: "",
    
    // Estoque
    possuiVariacoes: "Não",
    estoqueAtual: 0,
    estoqueMinimo: 0,
    estoqueMaximo: 0,
    genero: "todos",
    tamanho: "",
    cor: "",
    
    // Fiscal
    ncm: "",
    cest: "",
    origem: "0",
    pesoLiquido: 0,
    pesoBruto: 0,
  })

  const custoFinal = useMemo(() => {
    return Number(form.custoBase) + Number(form.despesasAcessorias) + Number(form.outrasDespesas)
  }, [form.custoBase, form.despesasAcessorias, form.outrasDespesas])

  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [grupos, setGrupos] = useState<any[]>([])
  const [variantSuggestions, setVariantSuggestions] = useState<string[]>([])

  const loadDependencies = useCallback(async () => {
    try {
      const [catRes, supRes, variantsRes] = await Promise.all([
        getProductCategories(),
        getSuppliers(),
        getProductVariants()
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
      if (variantsRes.success && variantsRes.data) {
        setVariantSuggestions([...new Set(
          variantsRes.data
            .map((variant: any) => variant.name?.trim())
            .filter((name: string | undefined) => name && name !== "Único")
        )].sort((a, b) => a.localeCompare(b, "pt-BR")) as string[]);
      }
    } catch (error) {
      console.error("Error loading dropdown data:", error);
    }
  }, []);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  const [isNewGrupoDialogOpen, setIsNewGrupoDialogOpen] = useState(false)
  const [isNewFornecedorDialogOpen, setIsNewFornecedorDialogOpen] = useState(false)
  const [newGrupoName, setNewGrupoName] = useState("")
  const [newFornecedorName, setNewFornecedorName] = useState("")
  const [isCreatingGrupo, setIsCreatingGrupo] = useState(false)
  const [isCreatingFornecedor, setIsCreatingFornecedor] = useState(false)

  const handleFieldChange = (field: string, value: string | number) => {
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

  const handleCreateNewGrupo = async () => {
    if (!newGrupoName.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
      return
    }
    setIsCreatingGrupo(true)
    try {
      const res = await createProductCategory({
        name: newGrupoName,
        description: ""
      });
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
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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
      const res = await createSupplier({
        name: newFornecedorName
      });
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
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsCreatingFornecedor(false)
    }
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
      return
    }

    setIsSaving(true)
    try {
      const res = await createProduct({
        name: form.nome,
        internalCode: form.codigoInterno || `COD-${Date.now()}`,
        description: "",
        categoryId: form.grupo || null,
        supplierId: form.fornecedorId || null,
        imageUrl: "",
        thumbnailUrl: "",
        galleryUrls: [],
        costPrice: safeNumber(form.custoBase) ?? 0,
        salePrice: safeNumber(form.valorVenda) ?? 0,
        barcode: form.codigoBarras || null,
        barcodeType: null,
      });

      if (res.success) {
        toast({ title: "Sucesso", description: "Operação realizada com sucesso." })
        router.push("/produtos")
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error || "Ocorreu um erro ao salvar o produto." })
      }
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-bold">Nãovo Produto</h1>
            <p className="text-muted-foreground text-sm">Preencha as informações para cadastrar um novo produto no estoque.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b] hover:text-white transition-colors"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[#28a745] hover:bg-[#218838] text-white transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : "Cadastrar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto gap-2 bg-transparent">
          <TabsTrigger value="dados" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card">Dados Principais</TabsTrigger>
          <TabsTrigger value="valores" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card">Valores e Custos</TabsTrigger>
          <TabsTrigger value="estoque" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card">Estoque & Variações</TabsTrigger>
          <TabsTrigger value="fotos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card">Fotos</TabsTrigger>
          <TabsTrigger value="fiscal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card">Fiscal</TabsTrigger>
        </TabsList>

        <div className="mt-6 bg-card border rounded-xl p-6 shadow-sm min-h-[500px]">
          {/* ABA DADOS */}
          <TabsContent value="dados" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Informações básicas de identificação do produto. O Código Interno pode ser gerado automaticamente.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="nome">Nãome do Produto *</Label>
                <Input 
                  id="nome" 
                  placeholder="Ex: Camiseta Algodão Básica" 
                  value={form.nome} 
                  onChange={(e) => handleFieldChange("nome", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoInterno">Código Interno</Label>
                <div className="flex gap-2">
                  <Input 
                    id="codigoInterno" 
                    placeholder="Ex: PRD-001" 
                    value={form.codigoInterno} 
                    onChange={(e) => handleFieldChange("codigoInterno", e.target.value)} 
                  />
                  <Button variant="outline" size="icon" onClick={gerarCodigo} title="Gerar código aleatório">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoBarras">Código de Barras (EAN/GTIN)</Label>
                <Input 
                  id="codigoBarras" 
                  value={form.codigoBarras} 
                  onChange={(e) => handleFieldChange("codigoBarras", e.target.value)} 
                />
              </div>
              
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="grupo">Grupo do Produto</Label>
                <div className="flex gap-2">
                  <Select value={form.grupo} onValueChange={(v) => handleFieldChange("grupo", v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {grupos?.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => setIsNewGrupoDialogOpen(true)}
                    title="Criar novo grupo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
                <div className="flex gap-2">
                  <Select value={form.unidadeMedida} onValueChange={(v) => handleFieldChange("unidadeMedida", v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UN">Unidade (UN)</SelectItem>
                      <SelectItem value="CX">Caixa (CX)</SelectItem>
                      <SelectItem value="KG">Quilograma (KG)</SelectItem>
                      <SelectItem value="MT">Metro (MT)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    disabled
                    title="Cadastro de unidades indisponível: não existe fonte canônica no backend atual."
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Cadastro de novas unidades indisponível; use uma das unidades fixas suportadas.</p>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <div className="flex gap-2">
                  <Select value={form.fornecedorId} onValueChange={(v) => handleFieldChange("fornecedorId", v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um fornecedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores?.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nomeFornecedor || f.nomeFantasia || f.razaoSocial || f.nome}</SelectItem>
                      ))}
                      {!fornecedores?.length && (
                        <SelectItem value="none" disabled>Nenhum fornecedor cadastrado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => setIsNewFornecedorDialogOpen(true)}
                    title="Criar novo fornecedor"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="unidadeConversao">Conversão (Qtd em 1 {form.unidadeMedida})</Label>
                <Input 
                  id="unidadeConversao" 
                  type="number" 
                  min="1"
                  value={form.unidadeConversao} 
                  onChange={(e) => handleFieldChange("unidadeConversao", e.target.value)} 
                  placeholder="Ex: 12"
                />
              </div>
            </div>
          </TabsContent>

          {/* ABA VALORES */}
          <TabsContent value="valores" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900">
              <Info className="h-4 w-4" />
              <AlertDescription>
                O Valor de Venda é calculado automaticamente (Markup) baseando-se no Custo Final somado ao percentual de Lucro Utilizado.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Custos */}
              <div className="p-6 rounded-xl border bg-muted/20 space-y-6">
                <h3 className="font-semibold text-lg border-b pb-2">Composição de Custo</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="custoBase" className="text-right">Custo de Aquisição (R$)</Label>
                    <Input id="custoBase" type="number" min="0" step="0.01" value={form.custoBase} onChange={(e) => handleFieldChange("custoBase", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="despesasAcessorias" className="text-right">Despesas Acessórias (R$)</Label>
                    <Input id="despesasAcessorias" type="number" min="0" step="0.01" value={form.despesasAcessorias} onChange={(e) => handleFieldChange("despesasAcessorias", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="outrasDespesas" className="text-right">Outras Despesas (R$)</Label>
                    <Input id="outrasDespesas" type="number" min="0" step="0.01" value={form.outrasDespesas} onChange={(e) => handleFieldChange("outrasDespesas", e.target.value)} />
                  </div>
                  <div className="pt-4 mt-4 border-t flex justify-between items-center text-lg font-bold">
                    <span>Custo Final:</span>
                    <span className="text-destructive">R$ {custoFinal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Venda */}
              <div className="p-6 rounded-xl border bg-muted/20 space-y-6">
                <h3 className="font-semibold text-lg border-b pb-2">Formação de Preço</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="lucroSugerido" className="text-right text-muted-foreground">Lucro Sugerido do Grupo (%)</Label>
                    <Input id="lucroSugerido" type="number" value="30" disabled className="bg-muted" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="lucroUtilizado" className="text-right font-medium">Lucro Utilizado (%)</Label>
                    <Input id="lucroUtilizado" type="number" min="0" step="0.1" value={form.lucroUtilizado} onChange={(e) => handleLucroChange(e.target.value)} />
                  </div>
                  <div className="pt-4 mt-4 border-t flex items-center justify-between">
                    <Label htmlFor="valorVenda" className="text-xl font-bold">Valor de Venda Final:</Label>
                    <div className="flex items-center gap-2 max-w-[150px]">
                      <span className="text-primary font-bold">R$</span>
                      <Input 
                        id="valorVenda" 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={form.valorVenda} 
                        onChange={(e) => handleVendaChange(e.target.value)} 
                        className="text-primary font-bold text-lg text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA ESTOQUE */}
          <TabsContent value="estoque" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Configure os limites de estoque para receber alertas. Você também pode definir grade de variação (cor, tamanho).
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="estoqueMinimo">Estoque Mínimo</Label>
                <Input id="estoqueMinimo" type="number" value={form.estoqueMinimo} onChange={(e) => handleFieldChange("estoqueMinimo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoqueMaximo">Estoque Máximo</Label>
                <Input id="estoqueMaximo" type="number" value={form.estoqueMaximo} onChange={(e) => handleFieldChange("estoqueMaximo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoqueAtual">Estoque Atual</Label>
                <Input id="estoqueAtual" type="number" disabled={form.possuiVariacoes === "Sim"} value={form.estoqueAtual} onChange={(e) => handleFieldChange("estoqueAtual", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="possuiVariacoes">Possui Variações?</Label>
                <Select value={form.possuiVariacoes} disabled>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Cadastre o produto primeiro e gerencie suas variações no módulo Grades/Variações.</p>
              </div>

              <div className="lg:col-span-4 p-4 border rounded-xl mt-4 text-sm text-muted-foreground">
                A criação rápida de grade está desabilitada porque não existe modelo separado de Grade. ProductVariant é a fonte canônica.
                {variantSuggestions.length > 0 && ` Há ${variantSuggestions.length} nome(s) de variação já utilizados neste tenant.`}
              </div>
            </div>
          </TabsContent>

          {/* ABA FOTOS */}
          <TabsContent value="fotos" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Arraste as imagens do produto para cá ou clique para fazer upload. (Funcionalidade visual).
              </AlertDescription>
            </Alert>
            
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 flex flex-col items-center justify-center bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer min-h-[300px]">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <UploadCloud className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-1">Arraste e solte imagens aqui</h3>
              <p className="text-sm text-muted-foreground mb-4">JPG, PNG ou WebP. Tamanho máximo 5MB.</p>
              <Button variant="secondary">Procurar Arquivos</Button>
            </div>
          </TabsContent>

          {/* ABA FISCAL */}
          <TabsContent value="fiscal" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Dados fiscais obrigatórios para emissão de Nãota Fiscal. Consulte seu contador em caso de dúvidas.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="origem">Origem do Produto</Label>
                <Select value={form.origem} onValueChange={(v) => handleFieldChange("origem", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Nacional</SelectItem>
                    <SelectItem value="1">1 - Estrangeira - Importação direta</SelectItem>
                    <SelectItem value="2">2 - Estrangeira - Adquirida no mercado interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ncm">NCM</Label>
                <Input id="ncm" placeholder="0000.00.00" value={form.ncm} onChange={(e) => handleFieldChange("ncm", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cest">CEST</Label>
                <Input id="cest" placeholder="00.000.00" value={form.cest} onChange={(e) => handleFieldChange("cest", e.target.value)} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pesoLiquido">Peso Líquido (kg)</Label>
                <Input id="pesoLiquido" type="number" step="0.001" value={form.pesoLiquido} onChange={(e) => handleFieldChange("pesoLiquido", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pesoBruto">Peso Bruto (kg)</Label>
                <Input id="pesoBruto" type="number" step="0.001" value={form.pesoBruto} onChange={(e) => handleFieldChange("pesoBruto", e.target.value)} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Regras de Impostos (ICMS/IPI/PIS/COFINS)</Label>
                <Select defaultValue="padrao">
                  <SelectTrigger><SelectValue placeholder="Selecione o perfil tributário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Tributação Nãormal Padrão</SelectItem>
                    <SelectItem value="simples">Simples Nacional</SelectItem>
                    <SelectItem value="isento">Isento / Não Tributado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialog para criar novo grupo */}
      <Dialog open={isNewGrupoDialogOpen} onOpenChange={setIsNewGrupoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nãovo Grupo de Produtos</DialogTitle>
            <DialogDescription>Crie um novo grupo para categorizar seus produtos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newGrupoName">Nãome do Grupo *</Label>
              <Input 
                id="newGrupoName"
                value={newGrupoName}
                onChange={(e) => setNewGrupoName(e.target.value)}
                placeholder="Ex: Roupas, Calçados, Acessórios"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNewGrupoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateNewGrupo} disabled={isCreatingGrupo} className="bg-blue-600 hover:bg-blue-700">
                {isCreatingGrupo ? "Criando..." : "Criar Grupo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar novo fornecedor rápido */}
      <Dialog open={isNewFornecedorDialogOpen} onOpenChange={setIsNewFornecedorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nãovo Fornecedor Rápido</DialogTitle>
            <DialogDescription>Cadastre um fornecedor rapidamente. Detalhes completos poderão ser inseridos depois no menu Fornecedores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newFornecedorName">Nãome do Fornecedor *</Label>
              <Input 
                id="newFornecedorName"
                value={newFornecedorName}
                onChange={(e) => setNewFornecedorName(e.target.value)}
                placeholder="Ex: Distribuidora Silva"
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setIsNewFornecedorDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateNewFornecedor} disabled={isCreatingFornecedor} className="bg-blue-600 hover:bg-blue-700">
                {isCreatingFornecedor ? "Criando..." : "Criar Fornecedor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
