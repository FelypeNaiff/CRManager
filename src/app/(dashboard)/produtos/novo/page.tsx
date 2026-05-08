"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Package, Save, X, Info, UploadCloud, RefreshCw } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

export default function NovoProdutoPage() {
  const router = useRouter()
  const db = useFirestore()
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

  const fornecedoresQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "fornecedores"), orderBy("nome", "asc")) : null;
  }, [db]);
  const { data: fornecedores } = useCollection(fornecedoresQuery);

  const [variacoes, setVariacoes] = useState<any[]>([])

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

  const handleAddVariacao = () => {
    setVariacoes([...variacoes, { codigoInterno: "", codigoBarras: "", tamanho: "", estoqueAtual: 0 }])
  }

  const handleVariacaoChange = (index: number, field: string, value: any) => {
    const newVars = [...variacoes]
    newVars[index][field] = value
    setVariacoes(newVars)
  }

  const gerarCodigo = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    handleFieldChange("codigoInterno", `PRD-${timestamp}-${random}`)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "O produto precisa ter um nome." })
      return
    }

    if (!db) {
      toast({ variant: "destructive", title: "Erro de Conexão", description: "Banco de dados não disponível." })
      return
    }

    setIsSaving(true)
    try {
      await addDoc(collection(db, "produtos"), {
        ...form,
        custoFinal,
        variacoes: form.possuiVariacoes === "Sim" ? variacoes : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Sucesso!", description: "Produto cadastrado com sucesso." })
      router.push("/produtos")
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao salvar o produto." })
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
            <h1 className="text-2xl font-headline font-bold">Novo Produto</h1>
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
                <Label htmlFor="nome">Nome do Produto *</Label>
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
                <Select value={form.grupo} onValueChange={(v) => handleFieldChange("grupo", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roupas">Roupas</SelectItem>
                    <SelectItem value="calcados">Calçados</SelectItem>
                    <SelectItem value="acessorios">Acessórios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
                <Select value={form.unidadeMedida} onValueChange={(v) => handleFieldChange("unidadeMedida", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidade (UN)</SelectItem>
                    <SelectItem value="CX">Caixa (CX)</SelectItem>
                    <SelectItem value="KG">Quilograma (KG)</SelectItem>
                    <SelectItem value="MT">Metro (MT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Select value={form.fornecedorId} onValueChange={(v) => handleFieldChange("fornecedorId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores?.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial || f.nome}</SelectItem>
                    ))}
                    {!fornecedores?.length && (
                      <SelectItem value="none" disabled>Nenhum fornecedor cadastrado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                <Select value={form.possuiVariacoes} onValueChange={(v) => handleFieldChange("possuiVariacoes", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Variações (Grade) Simples */}
              {form.possuiVariacoes === "Sim" && (
                <div className="lg:col-span-4 p-6 border rounded-xl mt-4 space-y-4">
                  <Alert className="bg-cyan-50/50 text-cyan-800 border-cyan-200">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Escolha abaixo quais são os tipos de grades que seu produto pode ter e adicione as variações.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center gap-4">
                    <Button onClick={handleAddVariacao} className="bg-slate-900 hover:bg-slate-800 text-white">
                      + Adicionar nova variação
                    </Button>
                  </div>

                  {variacoes.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground border-b">
                          <tr>
                            <th className="px-4 py-2 font-medium">Cód interno</th>
                            <th className="px-4 py-2 font-medium">Cód barra</th>
                            <th className="px-4 py-2 font-medium">Tamanho / Cor</th>
                            <th className="px-4 py-2 font-medium">Estoque atual</th>
                            <th className="px-4 py-2 font-medium w-16 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variacoes.map((v, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-2 py-2">
                                <Input value={v.codigoInterno} onChange={(e) => handleVariacaoChange(i, "codigoInterno", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <Input value={v.codigoBarras} onChange={(e) => handleVariacaoChange(i, "codigoBarras", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <Input value={v.tamanho} placeholder="Ex: M, Azul" onChange={(e) => handleVariacaoChange(i, "tamanho", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <Input type="number" value={v.estoqueAtual} onChange={(e) => handleVariacaoChange(i, "estoqueAtual", Number(e.target.value))} />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                  const n = [...variacoes];
                                  n.splice(i, 1);
                                  setVariacoes(n);
                                }}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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
                Dados fiscais obrigatórios para emissão de Nota Fiscal. Consulte seu contador em caso de dúvidas.
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
                    <SelectItem value="padrao">Tributação Normal Padrão</SelectItem>
                    <SelectItem value="simples">Simples Nacional</SelectItem>
                    <SelectItem value="isento">Isento / Não Tributado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
