"use client"

import { useState, useEffect } from "react"
import { useFirestore } from "@/firebase"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ArrowLeftRight } from "lucide-react"

interface Movimentacao {
  id: string
  dataHora: any
  entidade: string
  tipo: "Entrada" | "Saída"
  qntMovim: number
  qntFinal: number
  custoUnit: number
  custoTotal: number
  descricao: string
}

interface MovimentacoesModalProps {
  produtoId: string
  produtoNome: string
  isOpen: boolean
  onClose: () => void
}

export function MovimentacoesModal({ produtoId, produtoNome, isOpen, onClose }: MovimentacoesModalProps) {
  const db = useFirestore()
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && produtoId && db) {
      loadMovimentacoes()
    }
  }, [isOpen, produtoId, db])

  const loadMovimentacoes = async () => {
    setIsLoading(true)
    try {
      const q = query(
        collection(db!, "movimentacoes_estoque"),
        where("produtoId", "==", produtoId),
        // orderBy("dataHora", "desc") // Precisa de índice no Firestore, então ordenaremos no client se não houver índice
      )
      const snap = await getDocs(q)
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movimentacao))
      
      // Ordenação no client-side para evitar erro de índice faltando no Firebase temporariamente
      data.sort((a, b) => {
        const timeA = a.dataHora?.seconds || 0
        const timeB = b.dataHora?.seconds || 0
        return timeB - timeA // desc
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-headline text-slate-800 border-b pb-3">
            <ArrowLeftRight className="h-5 w-5 text-green-600" />
            Movimentação de Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm font-semibold mb-4 text-slate-700">Produto: <span className="font-normal text-slate-600">{produtoNome}</span></p>

          <div className="border rounded-sm overflow-hidden text-[13px]">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Data/hora</th>
                  <th className="px-3 py-2 font-semibold">Entidade</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Qnt. movim.</th>
                  <th className="px-3 py-2 font-semibold">Qnt. final</th>
                  <th className="px-3 py-2 font-semibold">Custo unit.</th>
                  <th className="px-3 py-2 font-semibold">Custo Total</th>
                  <th className="px-3 py-2 font-semibold">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Carregando movimentações...
                    </td>
                  </tr>
                ) : movimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhuma movimentação registrada para este produto.
                    </td>
                  </tr>
                ) : (
                  movimentacoes.map((mov) => (
                    <tr key={mov.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2">{formatData(mov.dataHora)}</td>
                      <td className="px-3 py-2">{mov.entidade || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${mov.tipo === "Entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td className={`px-3 py-2 font-medium ${mov.qntMovim > 0 ? "text-green-600" : "text-red-600"}`}>
                        {mov.qntMovim > 0 ? `+ ${mov.qntMovim}` : `- ${Math.abs(mov.qntMovim)}`}
                      </td>
                      <td className="px-3 py-2 font-semibold">{mov.qntFinal}</td>
                      <td className="px-3 py-2">{formatCurrency(mov.custoUnit)}</td>
                      <td className="px-3 py-2">{formatCurrency(mov.custoTotal)}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={mov.descricao}>{mov.descricao}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
