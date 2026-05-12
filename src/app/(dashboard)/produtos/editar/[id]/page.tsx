"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { addDoc, collection, doc, getDoc, query, orderBy, updateDoc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, Save, X, Info, RefreshCw } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface EditarProdutoPageProps {
  params: {
    id: string
  }
}

export default function EditarProdutoPage({ params }: EditarProdutoPageProps) {
  const router = useRouter()
  const db = useFirestore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [initialStock, setInitialStock] = useState(0)

  const [form, setForm] = useState({
    nome: "",
    codigoInterno: "",
    codigoBarras: "",
    grupo: "",
    unidadeMedida: "UN",
    unidadeConversao: "1",
    custoBase: 0,
    despesasAcessorias: 0,
    outrasDespesas: 0,
    lucroUtilizado: 0,
    valorVenda: 0,
    fornecedorId: "",
    possuiVariacoes: "Não",
    estoqueAtual: 0,
    estoqueMinimo: 0,
    estoqueMaximo: 0,
    genero: "todos",
    tamanho: "",
    cor: "",
    ncm: "",
    cest: "",
    origem: "0",
    pesoLiquido: 0,
    pesoBruto: 0,
    variacoes: [],
  })

  const fornecedoresQuery = useMemoFirebase(() => db ? query(collection(db, "fornecedores"), orderBy("nomeFornecedor", "asc")) : null, [db])
  const { data: fornecedores } = useCollection(fornecedoresQuery)

  const gruposQuery = useMemoFirebase(() => db ? query(collection(db, "gruposProdutos"), orderBy("nome", "asc")) : null, [db])
  const { data: grupos } = useCollection(gruposQuery)

  const gradesQuery = useMemoFirebase(() => db ? query(collection(db, "gradesVariacoes"), orderBy("nome", "asc")) : null, [db])
  const { data: grades } = useCollection(gradesQuery)

  const unidadesQuery = useMemoFirebase(() => db ? query(collection(db, "unidadesProdutos"), orderBy("nome", "asc")) : null, [db])
  const { data: unidades } = useCollection(unidadesQuery)

  const custoFinal = useMemo(() => {
    return Number(form.custoBase) + Number(form.despesasAcessorias) + Number(form.outrasDespesas)
  }, [form.custoBase, form.despesasAcessorias, form.outrasDespesas])

  useEffect(() => {
    if (!db) return

    const loadProduto = async () => {
      setIsLoading(true)
      try {
        const produtoDoc = await getDoc(doc(db, "produtos", params.id))
        if (produtoDoc.exists()) {
          const produtoData: any = produtoDoc.data()
          setForm({
            nome: produtoData.nome || "",
            codigoInterno: produtoData.codigoInterno || "",
            codigoBarras: produtoData.codigoBarras || "",
            grupo: produtoData.grupo || "",
            unidadeMedida: produtoData.unidadeMedida || "UN",
            unidadeConversao: produtoData.unidadeConversao || "1",
            custoBase: produtoData.custoBase || 0,
            despesasAcessorias: produtoData.despesasAcessorias || 0,
            outrasDespesas: produtoData.outrasDespesas || 0,
            lucroUtilizado: produtoData.lucroUtilizado || 0,
            valorVenda: produtoData.valorVenda || 0,
            fornecedorId: produtoData.fornecedorId || "",
            possuiVariacoes: produtoData.possuiVariacoes || "Não",
            estoqueAtual: produtoData.estoqueAtual || 0,
            estoqueMinimo: produtoData.estoqueMinimo || 0,
            estoqueMaximo: produtoData.estoqueMaximo || 0,
            genero: produtoData.genero || "todos",
            tamanho: produtoData.tamanho || "",
            cor: produtoData.cor || "",
            ncm: produtoData.ncm || "",
            cest: produtoData.cest || "",
            origem: produtoData.origem || "0",
            pesoLiquido: produtoData.pesoLiquido || 0,
            pesoBruto: produtoData.pesoBruto || 0,
            variacoes: produtoData.variacoes || [],
          })
          setInitialStock(Number(produtoData.estoqueAtual || 0))
        } else {
          toast({ variant: "destructive", title: "Produto não encontrado" })
          router.push("/produtos")
        }
      } catch (error) {
        console.error(error)
        toast({ variant: "destructive", title: "Erro ao carregar produto" })
      } finally {
        setIsLoading(false)
      }
    }

    loadProduto()
  }, [db, params.id, router])

  const handleFieldChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleAddVariacao = () => {
    setForm(prev => ({
      ...prev,
      variacoes: [...prev.variacoes, { codigoInterno: "", codigoBarras: "", tamanho: "", estoqueAtual: 0 }],
    }))
  }

  const handleVariacaoChange = (index: number, field: string, value: any) => {
    setForm(prev => {
      const variacoes = [...prev.variacoes]
      variacoes[index] = { ...variacoes[index], [field]: value }

      if (field === "tamanho" && value) {
        const baseCode = prev.codigoInterno ? `${prev.codigoInterno}-` : ""
        variacoes[index].codigoInterno = `${baseCode}${value}`.trim().replace(/\s+/g, "-").toUpperCase()
      }

      return { ...prev, variacoes }
    })
  }

  useEffect(() => {
    if (form.possuiVariacoes === "Sim") {
      const totalEstoque = form.variacoes.reduce((acc, curr) => acc + (Number(curr.estoqueAtual) || 0), 0)
      if (Number(form.estoqueAtual) !== totalEstoque) {
        setForm(prev => ({ ...prev, estoqueAtual: totalEstoque }))
      }
    }
  }, [form.possuiVariacoes, form.variacoes, form.estoqueAtual])

  const createStockMovementRecord = async (oldQty: number, newQty: number) => {
    if (!db) return
    const diff = Number(newQty) - Number(oldQty)
    if (diff === 0) return

    const tipo = diff > 0 ? "Entrada" : "Saída"
    try {
      await addDoc(collection(db, "movimentacoes_estoque"), {
        produtoId: params.id,
        dataHora: serverTimestamp(),
        entidade: "Estoque manual",
        tipo,
        qntMovim: diff,
        qntFinal: Number(newQty),
        custoUnit: Number(form.valorVenda || 0),
        custoTotal: Number(form.valorVenda || 0) * diff,
        descricao: "Ajuste via edição de produto",
      })
    } catch (error) {
      console.error("Erro ao criar movimentação de estoque:", error)
    }
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
      const newStock = Number(form.estoqueAtual)
      await updateDoc(doc(db, "produtos", params.id), {
        ...form,
        custoBase: Number(form.custoBase),
        despesasAcessorias: Number(form.despesasAcessorias),
        outrasDespesas: Number(form.outrasDespesas),
        lucroUtilizado: Number(form.lucroUtilizado),
        valorVenda: Number(form.valorVenda),
        estoqueAtual: newStock,
        estoqueMinimo: Number(form.estoqueMinimo),
        estoqueMaximo: Number(form.estoqueMaximo),
        pesoLiquido: Number(form.pesoLiquido),
        pesoBruto: Number(form.pesoBruto),
        updatedAt: serverTimestamp(),
      })

      await createStockMovementRecord(initialStock, newStock)

      toast({ title: "Produto atualizado com sucesso." })
      router.push("/produtos")
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro ao salvar produto." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-bold">Editar Produto</h1>
            <p className="text-muted-foreground text-sm">Altere todas as informações do produto cadastrado.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/produtos")} className="border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b] hover:text-white transition-colors">
            <X className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-[#28a745] hover:bg-[#218838] text-white transition-colors">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"
            }
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
          <TabsContent value="dados" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertDescription>Edite as informações principais de identificação do produto.</AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="nome">Nome do Produto *</Label>
                <Input id="nome" placeholder="Ex: Camiseta Algodão Básica" value={form.nome} onChange={(e) => handleFieldChange("nome", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoInterno">Código Interno</Label>
                <div className="flex gap-2">
                  <Input id="codigoInterno" placeholder="Ex: PRD-001" value={form.codigoInterno} onChange={(e) => handleFieldChange("codigoInterno", e.target.value)} />
                  <Button variant="outline" size="icon" onClick={() => handleFieldChange("codigoInterno", `PRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`)} title="Gerar código aleatório">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoBarras">Código de Barras</Label>
                <Input id="codigoBarras" value={form.codigoBarras} onChange={(e) => handleFieldChange("codigoBarras", e.target.value)} />
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
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Select value={form.fornecedorId} onValueChange={(v) => handleFieldChange("fornecedorId", v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores?.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nomeFornecedor || f.nomeFantasia || f.razaoSocial || f.nome}</SelectItem>
                    ))}
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
                    {unidades?.filter(u => !["UN", "CX", "KG", "MT"].includes(u.sigla)).map(u => (
                      <SelectItem key={u.id} value={u.sigla}>{u.nome} ({u.sigla})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidadeConversao">Conversão</Label>
                <Input id="unidadeConversao" type="number" min="1" value={form.unidadeConversao} onChange={(e) => handleFieldChange("unidadeConversao", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="valores" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertDescription>Atualize os custos e o preço de venda do produto.</AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

              <div className="p-6 rounded-xl border bg-muted/20 space-y-6">
                <h3 className="font-semibold text-lg border-b pb-2">Formação de Preço</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="lucroUtilizado" className="text-right font-medium">Lucro Utilizado (%)</Label>
                    <Input id="lucroUtilizado" type="number" min="0" step="0.1" value={form.lucroUtilizado} onChange={(e) => handleFieldChange("lucroUtilizado", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label htmlFor="valorVenda" className="text-right">Valor de Venda (R$)</Label>
                    <Input id="valorVenda" type="number" min="0" step="0.01" value={form.valorVenda} onChange={(e) => handleFieldChange("valorVenda", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="estoque" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertDescription>Atualize o controle de estoque, variações e limites.</AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 rounded-xl border bg-muted/20 space-y-6">
                <h3 className="font-semibold text-lg border-b pb-2">Estoque</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estoqueAtual">Estoque Atual</Label>
                    <Input id="estoqueAtual" type="number" disabled={form.possuiVariacoes === "Sim"} value={form.estoqueAtual} onChange={(e) => handleFieldChange("estoqueAtual", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoqueMinimo">Estoque Mínimo</Label>
                    <Input id="estoqueMinimo" type="number" value={form.estoqueMinimo} onChange={(e) => handleFieldChange("estoqueMinimo", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoqueMaximo">Estoque Máximo</Label>
                    <Input id="estoqueMaximo" type="number" value={form.estoqueMaximo} onChange={(e) => handleFieldChange("estoqueMaximo", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="possuiVariacoes">Possui Variações?</Label>
                    <Select value={form.possuiVariacoes} onValueChange={(v) => handleFieldChange("possuiVariacoes", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não">Não</SelectItem>
                        <SelectItem value="Sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="genero">Gênero</Label>
                    <Select value={form.genero} onValueChange={(v) => handleFieldChange("genero", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="unissex">Unissex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tamanho">Tamanho</Label>
                    <Input id="tamanho" value={form.tamanho} onChange={(e) => handleFieldChange("tamanho", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cor">Cor</Label>
                    <Input id="cor" value={form.cor} onChange={(e) => handleFieldChange("cor", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 p-6 rounded-xl border bg-muted/20 space-y-6">
                <h3 className="font-semibold text-lg border-b pb-2">Variações</h3>
                <div className="space-y-3">
                  <Alert className="bg-cyan-50/50 text-cyan-800 border-cyan-200">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Escolha abaixo quais são os tipos de grades que seu produto pode ter e adicione as variações.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between gap-4">
                    <Button onClick={handleAddVariacao} className="bg-slate-900 hover:bg-slate-800 text-white">
                      + Adicionar nova variação
                    </Button>
                  </div>

                  {form.variacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma variação registrada.</p>
                  ) : (
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
                          {form.variacoes.map((variacao: any, index: number) => (
                            <tr key={index} className="border-b last:border-0 bg-white">
                              <td className="px-2 py-2">
                                <Input value={variacao.codigoInterno} onChange={(e) => handleVariacaoChange(index, "codigoInterno", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <Input value={variacao.codigoBarras} onChange={(e) => handleVariacaoChange(index, "codigoBarras", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <div className="grid gap-2">
                                  <Select value={variacao.tamanho} onValueChange={(val) => handleVariacaoChange(index, "tamanho", val)}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                      {grades?.map(grade => (
                                        <SelectGroup key={grade.id}>
                                          <SelectLabel>{grade.nome}</SelectLabel>
                                          {grade.valores?.map((valor: string) => (
                                            <SelectItem key={`${grade.id}-${valor}`} value={valor}>{valor}</SelectItem>
                                          ))}
                                        </SelectGroup>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input placeholder="Cor" value={variacao.cor || ""} onChange={(e) => handleVariacaoChange(index, "cor", e.target.value)} />
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <Input type="number" value={variacao.estoqueAtual} onChange={(e) => handleVariacaoChange(index, "estoqueAtual", Number(e.target.value))} />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                  const updated = [...form.variacoes]
                                  updated.splice(index, 1)
                                  setForm(prev => ({ ...prev, variacoes: updated }))
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fotos" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertDescription>Adicione ou atualize fotos e imagens do produto.</AlertDescription>
            </Alert>
            <div className="rounded-xl border p-6 bg-muted/20">
              <p className="text-sm text-muted-foreground">O upload de imagens ainda não está disponível nesta página.</p>
            </div>
          </TabsContent>

          <TabsContent value="fiscal" className="m-0 space-y-6">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertDescription>Atualize os dados fiscais e de transporte do produto.</AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origem">Origem do Produto</Label>
                <Select value={form.origem} onValueChange={(v) => handleFieldChange("origem", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Nacional</SelectItem>
                    <SelectItem value="1">1 - Estrangeira - Importação direta</SelectItem>
                    <SelectItem value="2">2 - Estrangeira - Adquirida no mercado interno</SelectItem>
                    <SelectItem value="3">3 - Nacional, mercadoria com Conteúdo de Importação superior a 40%</SelectItem>
                    <SelectItem value="4">4 - Nacional, mercadoria com Conteúdo de Importação inferior ou igual a 40%</SelectItem>
                    <SelectItem value="5">5 - Nacional, mercadoria com Conteúdo de Importação superior a 70%</SelectItem>
                    <SelectItem value="6">6 - Estrangeira - Importação por encomenda</SelectItem>
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
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
