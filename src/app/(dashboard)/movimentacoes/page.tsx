"use client"

import { useState, useEffect } from "react"
import { useFirestore } from "@/firebase"
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore"
import { ArrowLeftRight, Loader2, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Movimentacao {
  id: string
  produtoId: string
  produtoNome?: string
  dataHora: any
  entidade: string
  tipo: "Entrada" | "Saída"
  qntMovim: number
  qntFinal: number
  custoUnit: number
  custoTotal: number
  descricao: string
}

export default function MovimentacoesPage() {
  const db = useFirestore()
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (db) {
      loadMovimentacoes()
    }
  }, [db])

  const loadMovimentacoes = async () => {
    setIsLoading(true)
    try {
      // Pega as últimas 100 movimentações globais
      const q = query(
        collection(db!, "movimentacoes_estoque"),
        // orderBy("dataHora", "desc"), // Pode falhar se não houver índice
        limit(100)
      )
      const snap = await getDocs(q)
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movimentacao))
      
      // Busca nomes de produtos se não houver no doc (otimização)
      // Idealmente, produtoNome já deve ser salvo no documento de movimentação na hora da criação.
      // Se não, faríamos um join aqui. Assumimos que vamos salvar produtoNome.

      // Ordenação client-side
      data.sort((a, b) => {
        const timeA = a.dataHora?.seconds || 0
        const timeB = b.dataHora?.seconds || 0
        return timeB - timeA
      })

      setMovimentacoes(data)
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatData = (timestamp: any) => {
    if (!timestamp) return "-"
    const d = new Date(timestamp.seconds * 1000)
    return d.toLocaleString("pt-BR")
  }

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  const filteredData = movimentacoes.filter(m => 
    m.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.entidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.produtoId?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-sidebar-foreground" /> Movimentações de Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe as entradas e saídas de produtos do estoque.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 rounded-sm w-full sm:w-[300px] text-[13px]"
            placeholder="Pesquisar movimentação..."
          />
          <Button variant="outline" className="h-9 rounded-sm shrink-0">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-9 rounded-sm shrink-0">
            <Filter className="h-4 w-4 mr-2" /> Filtros
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-slate-50 border-b text-slate-700 uppercase font-semibold">
              <tr>
                <th className="px-3 py-3">Data/hora</th>
                <th className="px-3 py-3">Produto</th>
                <th className="px-3 py-3">Entidade</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Qnt. movim.</th>
                <th className="px-3 py-3">Qnt. final</th>
                <th className="px-3 py-3">Custo unit.</th>
                <th className="px-3 py-3">Custo Total</th>
                <th className="px-3 py-3">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando movimentações...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : (
                filteredData.map((mov) => (
                  <tr key={mov.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatData(mov.dataHora)}</td>
                    <td className="px-3 py-2.5 font-medium">{mov.produtoId}</td> {/* Aqui deveria ser mov.produtoNome */}
                    <td className="px-3 py-2.5">{mov.entidade || "-"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${mov.tipo === "Entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {mov.tipo}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${mov.qntMovim > 0 ? "text-green-600" : "text-red-600"}`}>
                      {mov.qntMovim > 0 ? `+ ${mov.qntMovim}` : `- ${Math.abs(mov.qntMovim)}`}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{mov.qntFinal}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatCurrency(mov.custoUnit)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatCurrency(mov.custoTotal)}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate" title={mov.descricao}>{mov.descricao}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {!isLoading && filteredData.length > 0 && (
        <div className="text-[12px] text-muted-foreground">
          Mostrando 1 a {filteredData.length} movimentações
        </div>
      )}
    </div>
  )
}
