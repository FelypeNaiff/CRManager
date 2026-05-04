"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Package, Plus, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export default function ProdutosPage() {
  const router = useRouter()
  const db = useFirestore()

  const produtosQuery = db ? query(collection(db, "produtos"), orderBy("createdAt", "desc")) : null
  const { data: produtos, isLoading } = useCollection(produtosQuery)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" /> Produtos
          </h1>
          <p className="text-muted-foreground">Gerencie o catálogo e estoque de produtos.</p>
        </div>
        <Button 
          className="gap-2 bg-[#28a745] hover:bg-[#218838] text-white" 
          onClick={() => router.push("/produtos/novo")}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      ) : !produtos || produtos.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum produto cadastrado.</p>
          <p className="text-muted-foreground text-sm mt-1">Comece adicionando seu primeiro produto ao catálogo.</p>
          <Button 
            variant="outline" 
            className="mt-4" 
            onClick={() => router.push("/produtos/novo")}
          >
            Cadastrar Produto
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Venda</th>
                  <th className="px-4 py-3 font-medium text-center">Estoque</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => (
                  <tr key={produto.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-muted-foreground">
                      {produto.codigoInterno || "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {produto.nome}
                    </td>
                    <td className="px-4 py-3 text-right text-primary font-bold">
                      R$ {Number(produto.valorVenda || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="bg-background">
                        {produto.estoqueAtual || 0} {produto.unidadeMedida || "UN"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{produto.grupo || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/produtos/${produto.id}`)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
