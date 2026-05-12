"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, Plus, Loader2, Search, ChevronDown, List, Eye, Pencil, X, Minus, AlertCircle, FileSpreadsheet, FileText, Download, DollarSign, Tag as TagIcon, Trash2, ArrowLeftRight, History, Copy, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, getDocs } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MovimentacoesModal } from "@/components/produtos/MovimentacoesModal"

export default function ProdutosPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  
  const [selectedProdutoForMov, setSelectedProdutoForMov] = useState<{id: string, nome: string} | null>(null)
  const [isMovimentacoesOpen, setIsMovimentacoesOpen] = useState(false)

  const [isAdvSearchOpen, setIsAdvSearchOpen] = useState(false)
  const [advFilters, setAdvFilters] = useState({
    grupo: "",
    nome: "",
    codigo: "",
    fornecedor: "",
    marca: ""
  })
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null)

  const [isSaving, setIsSaving] = useState(false)

  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [stockProduto, setStockProduto] = useState<any>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingProduto, setViewingProduto] = useState<any>(null)
  const [historicoValores, setHistoricoValores] = useState<any[]>([])

  const produtosQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "produtos"), orderBy("createdAt", "desc")) : null
  }, [db])
  const { data: produtos, isLoading, error } = useCollection(produtosQuery)

  const gruposQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "gruposProdutos"), orderBy("nome", "asc")) : null
  }, [db])
  const { data: grupos } = useCollection(gruposQuery)

  const fornecedoresQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "fornecedores"), orderBy("nomeFornecedor", "asc")) : null
  }, [db])
  const { data: fornecedores } = useCollection(fornecedoresQuery)

  const [cols, setCols] = useState({
    codigo: true,
    nome: true,
    valor: true,
    estoque: true,
    cadastrado: true,
  })

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const renderSortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="h-3 w-3 ml-1 inline text-muted-foreground opacity-50" />
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 inline text-primary" /> 
      : <ArrowDown className="h-3 w-3 ml-1 inline text-primary" />
  }

  const processedProdutos = useMemo(() => {
    if (!produtos) return []
    
    let result = [...produtos]

    // Filtro da busca principal
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(p => 
        p.nome?.toLowerCase().includes(lowerSearch) ||
        p.codigoInterno?.toLowerCase().includes(lowerSearch)
      )
    }

    // Filtros da busca avançada
    if (isAdvSearchOpen) {
      if (advFilters.nome) result = result.filter(p => p.nome?.toLowerCase().includes(advFilters.nome.toLowerCase()))
      if (advFilters.codigo) result = result.filter(p => p.codigoInterno?.toLowerCase().includes(advFilters.codigo.toLowerCase()))
      if (advFilters.grupo) result = result.filter(p => p.grupo === advFilters.grupo)
      if (advFilters.fornecedor) result = result.filter(p => p.fornecedorId === advFilters.fornecedor)
      if (advFilters.marca) result = result.filter(p => p.marca?.toLowerCase().includes(advFilters.marca.toLowerCase()))
    }

    // Ordenação
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key]
        let bValue = b[sortConfig.key]

        if (sortConfig.key === 'valor') {
          aValue = Number(a.valorVenda || 0)
          bValue = Number(b.valorVenda || 0)
        } else if (sortConfig.key === 'estoque') {
          aValue = Number(a.estoqueAtual || 0)
          bValue = Number(b.estoqueAtual || 0)
        } else if (sortConfig.key === 'cadastrado') {
          aValue = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
          bValue = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
        } else if (sortConfig.key === 'codigo') {
          aValue = a.codigoInterno || ""
          bValue = b.codigoInterno || ""
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [produtos, searchTerm, isAdvSearchOpen, advFilters, sortConfig])

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        await deleteDoc(doc(db, "produtos", id))
        toast({ title: "Produto excluído com sucesso." })
      } catch (err) {
        toast({ variant: "destructive", title: "Erro ao excluir produto." })
      }
    }
  }

  const handleView = async (produto: any) => {
    setViewingProduto(produto)
    setIsViewModalOpen(true)
    
    if (db) {
        const hq = query(collection(db, "produtos", produto.id, "historico_precos"), orderBy("dataAlteracao", "desc"))
        const snaps = await getDocs(hq)
        setHistoricoValores(snaps.docs.map(d => ({id: d.id, ...d.data()})))
    }
  }

  const handleOpenStockModal = (produto: any) => {
    setStockProduto({
      id: produto.id,
      nome: produto.nome || "",
      estoqueAtual: produto.estoqueAtual || 0,
    })
    setIsStockModalOpen(true)
  }

  const createStockMovementRecord = async (
    produtoId: string,
    oldQty: number,
    newQty: number,
    custoUnit: number,
    descricao: string
  ) => {
    if (!db) return
    const diff = Number(newQty) - Number(oldQty)
    if (diff === 0) return

    const tipo = diff > 0 ? "Entrada" : "Saída"
    try {
      await addDoc(collection(db, "movimentacoes_estoque"), {
        produtoId,
        dataHora: serverTimestamp(),
        entidade: "Estoque manual",
        tipo,
        qntMovim: diff,
        qntFinal: Number(newQty),
        custoUnit: Number(custoUnit || 0),
        custoTotal: Number(custoUnit || 0) * diff,
        descricao,
      })
    } catch (err) {
      console.error("Erro ao criar movimentação de estoque:", err)
    }
  }

  const handleSaveStock = async () => {
    if (!stockProduto || !db) return
    setIsSaving(true)
    try {
      const existingProduto = produtos?.find((p: any) => p.id === stockProduto.id)
      const oldStock = Number(existingProduto?.estoqueAtual || 0)
      const newStock = Number(stockProduto.estoqueAtual)
      const custoUnit = Number(existingProduto?.valorVenda || 0)

      await updateDoc(doc(db, "produtos", stockProduto.id), {
        estoqueAtual: newStock,
        updatedAt: serverTimestamp(),
      })

      await createStockMovementRecord(
        stockProduto.id,
        oldStock,
        newStock,
        custoUnit,
        `Ajuste manual de estoque pelo usuário`
      )

      toast({ title: "Estoque atualizado com sucesso!" })
      setIsStockModalOpen(false)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao atualizar estoque." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloneProduct = async (produto: any) => {
    setIsSaving(true)
    try {
      await addDoc(collection(db, "produtos"), {
        ...produto,
        id: undefined,
        nome: `${produto.nome} (Cópia)`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Produto clonado com sucesso!" })
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao clonar produto." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Breadcrumb simulado */}
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Produtos</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">Listar</span>
      </div>

      {/* Header Clássico ERP */}
      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Package className="h-5 w-5 text-sidebar-foreground" /> Produtos
        </h1>
      </div>

      {/* Toolbar ERP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-1">
          <Button 
            className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]" 
            onClick={() => router.push("/produtos/novo")}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="btn-erp-dark gap-1 h-8 rounded-sm px-3 text-[13px]">
                <List className="h-3.5 w-3.5" /> Mais ações <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => router.push('/produtos/importar-planilha')}><FileSpreadsheet className="h-4 w-4 mr-2" /> Importar de uma planilha</DropdownMenuItem>
              <DropdownMenuItem><FileText className="h-4 w-4 mr-2" /> Importar de notas fiscais</DropdownMenuItem>
              <DropdownMenuItem><Download className="h-4 w-4 mr-2" /> Exportar cadastros</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><DollarSign className="h-4 w-4 mr-2" /> Ajustar valores em massa</DropdownMenuItem>
              <DropdownMenuItem><Package className="h-4 w-4 mr-2" /> Ajustar produtos em massa</DropdownMenuItem>
              <DropdownMenuItem><TagIcon className="h-4 w-4 mr-2" /> Gerar etiquetas</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" /> Excluir produtos</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 w-8 p-0 rounded-sm ml-1 bg-gray-100 border-gray-300">
                <List className="h-4 w-4 text-gray-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <div className="px-2 py-1.5 text-sm font-semibold">Gerenciar colunas</div>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={cols.codigo} onCheckedChange={(v) => setCols(p => ({...p, codigo: v}))}>Código</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={cols.nome} onCheckedChange={(v) => setCols(p => ({...p, nome: v}))}>Nome</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={cols.valor} onCheckedChange={(v) => setCols(p => ({...p, valor: v}))}>Valor</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={cols.estoque} onCheckedChange={(v) => setCols(p => ({...p, estoque: v}))}>Estoque</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={cols.cadastrado} onCheckedChange={(v) => setCols(p => ({...p, cadastrado: v}))}>Cadastrado em</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 rounded-sm w-full sm:w-[300px] border-gray-300 focus-visible:ring-0 focus-visible:border-primary text-[13px]"
            placeholder="Pesquisar..."
          />
          <Button className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button 
            className="btn-erp-dark h-8 rounded-sm px-3 shrink-0 text-[13px]"
            onClick={() => setIsAdvSearchOpen(!isAdvSearchOpen)}
          >
            <Search className="h-3.5 w-3.5 mr-1.5" /> Busca avançada
          </Button>
        </div>
      </div>

      {/* Painel de Busca Avançada */}
      {isAdvSearchOpen && (
        <div className="bg-gray-50 p-4 border shadow-sm rounded-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Grupo</Label>
            <Select value={advFilters.grupo || "todos"} onValueChange={v => setAdvFilters(p => ({...p, grupo: v === "todos" ? "" : v}))}>
              <SelectTrigger className="h-8 text-[13px] bg-white border-gray-300">
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os grupos</SelectItem>
                {grupos?.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Nome</Label>
            <Input value={advFilters.nome} onChange={e => setAdvFilters(p => ({...p, nome: e.target.value}))} className="h-8 text-[13px] bg-white border-gray-300" placeholder="Nome do produto" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Código</Label>
            <Input value={advFilters.codigo} onChange={e => setAdvFilters(p => ({...p, codigo: e.target.value}))} className="h-8 text-[13px] bg-white border-gray-300" placeholder="Cód. interno" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Fornecedor</Label>
            <Select value={advFilters.fornecedor || "todos"} onValueChange={v => setAdvFilters(p => ({...p, fornecedor: v === "todos" ? "" : v}))}>
              <SelectTrigger className="h-8 text-[13px] bg-white border-gray-300">
                <SelectValue placeholder="Todos os fornecedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os fornecedores</SelectItem>
                {fornecedores?.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nomeFornecedor || f.nomeFantasia || f.razaoSocial || f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Marca</Label>
            <Input value={advFilters.marca} onChange={e => setAdvFilters(p => ({...p, marca: e.target.value}))} className="h-8 text-[13px] bg-white border-gray-300" placeholder="Marca do produto" />
          </div>
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <Button variant="destructive" className="h-8 text-xs px-4" onClick={() => setAdvFilters({grupo: "", nome: "", codigo: "", fornecedor: "", marca: ""})}>
              Limpar
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs px-4">
              Buscar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm flex-1">
            <h3 className="font-semibold text-base">Erro ao carregar produtos</h3>
            <p>{(error as any).message || "Verifique suas permissões no banco de dados."}</p>
          </div>
        </div>
      )}

      {/* Tabela de Alta Densidade ERP */}
      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-foreground uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                {cols.codigo && <th className="px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('codigo')}>Código {renderSortIcon('codigo')}</th>}
                {cols.nome && <th className="px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('nome')}>Nome {renderSortIcon('nome')}</th>}
                {cols.valor && <th className="px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('valor')}>Valor {renderSortIcon('valor')}</th>}
                {cols.estoque && <th className="px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('estoque')}>Estoque {renderSortIcon('estoque')}</th>}
                {cols.cadastrado && <th className="px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('cadastrado')}>Cadastrado em {renderSortIcon('cadastrado')}</th>}
                <th className="px-3 py-2 font-semibold text-center w-36">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando dados...
                  </td>
                </tr>
              ) : processedProdutos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                processedProdutos.map((produto) => (
                  <tr key={produto.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors group">
                    {cols.codigo && (
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {produto.codigoInterno || "-"}
                      </td>
                    )}
                    {cols.nome && (
                      <td className="px-3 py-2.5 font-medium text-primary">
                        <span className="bg-primary/10 px-1 py-0.5 rounded cursor-pointer hover:underline">
                          {produto.nome}
                        </span>
                      </td>
                    )}
                    {cols.valor && (
                      <td className="px-3 py-2.5">
                        {Number(produto.valorVenda || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    {cols.estoque && (
                      <td className={`px-3 py-2.5 ${Number(produto.estoqueAtual || 0) === 0 ? 'text-red-600 font-bold' : ''}`}>
                        {Number(produto.estoqueAtual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    {cols.cadastrado && (
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {produto.createdAt 
                          ? new Date(produto.createdAt?.seconds * 1000).toLocaleString("pt-BR")
                          : "-"}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button title="Visualizar" className="btn-erp-action-blue" onClick={() => handleView(produto)}>
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          title="Alterar estoque" 
                          className="btn-erp-action-yellow"
                          onClick={() => handleOpenStockModal(produto)}
                        >
                          <Package className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          title="Editar" 
                          className="btn-erp-action-orange"
                          onClick={() => router.push(`/produtos/editar/${produto.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button title="Excluir" className="btn-erp-action-red" onClick={() => handleDelete(produto.id)}>
                          <X className="h-4 w-4" />
                        </button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button title="Outras funcionalidades" className="btn-erp-action-green flex items-center px-1">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedProdutoForMov({ id: produto.id, nome: produto.nome })
                                setIsMovimentacoesOpen(true)
                              }}
                            >
                              <ArrowLeftRight className="h-4 w-4 mr-2" /> Movimentações de estoque
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleView(produto)}><History className="h-4 w-4 mr-2" /> Histórico de valores</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCloneProduct(produto)}><Copy className="h-4 w-4 mr-2" /> Clonar produto</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {!isLoading && produtos && (
        <div className="text-[12px] text-muted-foreground">
          Mostrando {processedProdutos.length} de um total de {produtos.length} produtos
        </div>
      )}

      {selectedProdutoForMov && (
        <MovimentacoesModal 
          isOpen={isMovimentacoesOpen}
          onClose={() => setIsMovimentacoesOpen(false)}
          produtoId={selectedProdutoForMov.id}
          produtoNome={selectedProdutoForMov.nome}
        />
      )}

      {/* Modal de Edição Rápida removido. Agora a edição completa abre em nova página. */}

      {/* Modal de Alterar Estoque */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Estoque</DialogTitle>
            <DialogDescription>Atualize a quantidade disponível do produto <span className="font-semibold text-foreground">{stockProduto?.nome}</span>.</DialogDescription>
          </DialogHeader>
          {stockProduto && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Estoque Atual</Label>
                <Input 
                  type="number"
                  value={stockProduto.estoqueAtual}
                  onChange={(e) => setStockProduto({ ...stockProduto, estoqueAtual: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsStockModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveStock} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar estoque
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl min-h-[500px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Produto</DialogTitle>
            <DialogDescription>Visão geral e histórico detalhado do produto.</DialogDescription>
          </DialogHeader>
          {viewingProduto && (
            <Tabs defaultValue="geral" className="w-full mt-4">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="vendas">Vendas</TabsTrigger>
                <TabsTrigger value="valores">Valores</TabsTrigger>
              </TabsList>
              <TabsContent value="geral" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-sm bg-gray-50">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Nome</p>
                    <p className="font-medium text-sm">{viewingProduto.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Código Interno</p>
                    <p className="font-medium text-sm">{viewingProduto.codigoInterno || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Código de Barras</p>
                    <p className="font-medium text-sm">{viewingProduto.codigoBarras || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Valor de Venda</p>
                    <p className="font-bold text-green-600 text-sm">R$ {Number(viewingProduto.valorVenda || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Estoque Atual</p>
                    <p className={`font-bold text-sm ${Number(viewingProduto.estoqueAtual) === 0 ? 'text-red-600' : 'text-gray-900'}`}>{viewingProduto.estoqueAtual}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="estoque" className="mt-4">
                <div className="p-4 border rounded-sm">
                  <p className="text-sm font-medium mb-2">Movimentações Recentes (Entradas/Saídas)</p>
                  <p className="text-xs text-muted-foreground mb-4">Para visualizar os registros completos de entradas e saídas, acesse a opção "Movimentações de Estoque" no menu de ações da listagem principal.</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    setIsViewModalOpen(false)
                    setSelectedProdutoForMov({ id: viewingProduto.id, nome: viewingProduto.nome })
                    setIsMovimentacoesOpen(true)
                  }}>
                    Abrir Movimentações de Estoque
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="vendas" className="mt-4">
                <div className="p-4 border rounded-sm">
                  <p className="text-sm font-medium mb-2">Últimas Vendas</p>
                  <p className="text-xs text-muted-foreground">O histórico detalhado de vendas que contêm este produto aparecerá aqui.</p>
                </div>
              </TabsContent>
              <TabsContent value="valores" className="mt-4">
                <div className="p-4 border rounded-sm">
                  <p className="text-sm font-medium mb-3">Histórico de Alterações de Preço</p>
                  {historicoValores.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma alteração de preço registrada ainda.</p>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="p-2">Data</th>
                          <th className="p-2 text-right">Valor Antigo</th>
                          <th className="p-2 text-right">Valor Novo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoValores.map((h, idx) => (
                          <tr key={h.id || idx} className="border-b">
                            <td className="p-2 text-muted-foreground">{h.dataAlteracao?.seconds ? new Date(h.dataAlteracao.seconds * 1000).toLocaleString('pt-BR') : "-"}</td>
                            <td className="p-2 text-right text-red-600">R$ {Number(h.valorAntigo || 0).toFixed(2)}</td>
                            <td className="p-2 text-right text-green-600 font-medium">R$ {Number(h.valorNovo || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}