"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Plus, Loader2, Search, ChevronDown, List, Eye, Pencil, X, Minus, AlertCircle, FileSpreadsheet, FileText, Download, DollarSign, Tag as TagIcon, Trash2, ArrowLeftRight, History, Copy } from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { MovimentacoesModal } from "@/components/produtos/MovimentacoesModal"

export default function ProdutosPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  
  const [selectedProdutoForMov, setSelectedProdutoForMov] = useState<{id: string, nome: string} | null>(null)
  const [isMovimentacoesOpen, setIsMovimentacoesOpen] = useState(false)

  const produtosQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "produtos"), orderBy("createdAt", "desc")) : null
  }, [db])
  const { data: produtos, isLoading, error } = useCollection(produtosQuery)

  const [cols, setCols] = useState({
    codigo: true,
    nome: true,
    valor: true,
    estoque: true,
    cadastrado: true,
  })

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
          <Button className="btn-erp-dark h-8 rounded-sm px-3 shrink-0 text-[13px]">
            <Search className="h-3.5 w-3.5 mr-1.5" /> Busca avançada
          </Button>
        </div>
      </div>

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
                {cols.codigo && <th className="px-3 py-2 font-semibold">Código</th>}
                {cols.nome && <th className="px-3 py-2 font-semibold">Nome</th>}
                {cols.valor && <th className="px-3 py-2 font-semibold">Valor</th>}
                {cols.estoque && <th className="px-3 py-2 font-semibold">Estoque</th>}
                {cols.cadastrado && <th className="px-3 py-2 font-semibold">Cadastrado em</th>}
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
              ) : !produtos || produtos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                produtos.map((produto) => (
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
                      <td className="px-3 py-2.5">
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
                        <button title="Visualizar" className="btn-erp-action-blue">
                          <Search className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          title="Editar" 
                          className="btn-erp-action-orange"
                          onClick={() => router.push(`/produtos/${produto.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button title="Excluir" className="btn-erp-action-red" onClick={() => handleDelete(produto.id)}>
                          <X className="h-4 w-4" />
                        </button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button title="Mais opções" className="btn-erp-action-green flex items-center px-1">
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
                            <DropdownMenuItem><History className="h-4 w-4 mr-2" /> Histórico de valores</DropdownMenuItem>
                            <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Clonar produto</DropdownMenuItem>
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
          Mostrando 1 a {produtos.length} de um total de {produtos.length}
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
    </div>
  )
}
