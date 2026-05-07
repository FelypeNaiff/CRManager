"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Plus, Loader2, Search, ChevronDown, List, Eye, Pencil, X, Minus } from "lucide-react"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"

export default function ProdutosPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")

  const produtosQuery = db ? query(collection(db, "produtos"), orderBy("createdAt", "desc")) : null
  const { data: produtos, isLoading } = useCollection(produtosQuery)

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
          <Button className="btn-erp-dark gap-1 h-8 rounded-sm px-3 text-[13px]">
            <List className="h-3.5 w-3.5" /> Mais ações <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button variant="outline" className="h-8 w-8 p-0 rounded-sm ml-1 bg-gray-100 border-gray-300">
            <List className="h-4 w-4 text-gray-700" />
          </Button>
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

      {/* Tabela de Alta Densidade ERP */}
      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-foreground uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 font-semibold">Código</th>
                <th className="px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">Valor</th>
                <th className="px-3 py-2 font-semibold">Estoque</th>
                <th className="px-3 py-2 font-semibold">Cadastrado em</th>
                <th className="px-3 py-2 font-semibold text-center w-32">Ações</th>
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
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {produto.codigoInterno || "-"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-primary">
                      <span className="bg-primary/10 px-1 py-0.5 rounded cursor-pointer hover:underline">
                        {produto.nome}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {Number(produto.valorVenda || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5">
                      {Number(produto.estoqueAtual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {produto.createdAt 
                        ? new Date(produto.createdAt?.seconds * 1000).toLocaleString("pt-BR")
                        : "-"}
                    </td>
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
                        <button title="Excluir" className="btn-erp-action-red">
                          <X className="h-4 w-4" />
                        </button>
                        <button title="Desativar" className="btn-erp-action-green">
                          <Minus className="h-4 w-4" />
                        </button>
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
    </div>
  )
}
