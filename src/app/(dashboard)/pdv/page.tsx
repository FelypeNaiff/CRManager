"use client"

export const dynamic = 'force-dynamic'

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { History, Search, Eye, Loader2, Receipt, Calendar, CreditCard, User, DollarSign, Printer } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function VendasPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  
  // Estados para o modal de detalhes
  const [selectedVenda, setSelectedVenda] = useState<any>(null)
  const [vendaItens, setVendaItens] = useState<any[]>([])
  const [isLoadingItens, setIsLoadingItens] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Carrega as vendas (ordenadas da mais recente para a mais antiga)
  const vendasQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "vendas"), orderBy("dataVenda", "desc")) : null
  }, [db])
  const { data: vendas, isLoading: isLoadingVendas } = useCollection(vendasQuery)

  // Carrega os clientes para podermos cruzar o ID com o Nome
  const clientesQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "clientes")) : null
  }, [db])
  const { data: clientes } = useCollection(clientesQuery)

  // Cria um mapa rápido de Clientes (ID -> Nome) para a tabela
  const clientesMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (clientes) {
      clientes.forEach(c => {
        map[c.id] = c.nome || c.razaoSocial || "Cliente sem nome"
      })
    }
    return map
  }, [clientes])

  // Filtra as vendas com base no termo de busca (busca pelo nome do cliente)
  const filteredVendas = useMemo(() => {
    if (!vendas) return []
    if (!searchTerm) return vendas
    const lowerSearch = searchTerm.toLowerCase()
    return vendas.filter(v => {
      const clienteNome = clientesMap[v.clientId]?.toLowerCase() || ""
      return clienteNome.includes(lowerSearch) || v.id.toLowerCase().includes(lowerSearch)
    })
  }, [vendas, clientesMap, searchTerm])

  // Função para formatar as datas do Firestore
  const formatDate = (timestamp: any) => {
    if (!timestamp || !timestamp.seconds) return "-"
    return new Date(timestamp.seconds * 1000).toLocaleString("pt-BR")
  }

  // Função para abrir o modal e carregar os itens vendidos daquela venda
  const handleViewVenda = async (venda: any) => {
    setSelectedVenda(venda)
    setIsModalOpen(true)
    setVendaItens([])
    
    if (!db) return
    setIsLoadingItens(true)
    
    try {
      const q = query(collection(db, `vendas/${venda.id}/venda_itens`))
      const snapshot = await getDocs(q)
      const itens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setVendaItens(itens)
    } catch (error) {
      console.error("Erro ao carregar itens da venda", error)
    } finally {
      setIsLoadingItens(false)
    }
  }

  // Função para abrir e imprimir o comprovante estilo cupom não fiscal
  const handlePrintReceipt = () => {
    if (!selectedVenda) return

    // Abre uma nova janela limpa para gerar o cupom
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      toast({ variant: "destructive", title: "Erro", description: "O bloqueador de pop-ups impediu a impressão." })
      return
    }

    // HTML otimizado para bobinas térmicas (aprox. 80mm de largura = 300px)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprovante - ${selectedVenda.id}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 10px; width: 300px; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { text-align: left; padding: 4px 0; vertical-align: top; }
            .right { text-align: right; }
            .mb-1 { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="center bold mb-1">TRUPE KIDS MODA INFANTIL</div>
          <div class="center">CUPOM NÃO FISCAL</div>
          <div class="divider"></div>
          <div><span class="bold">Data:</span> ${formatDate(selectedVenda.dataVenda)}</div>
          <div><span class="bold">Pedido:</span> ${selectedVenda.id}</div>
          <div><span class="bold">Cliente:</span> ${clientesMap[selectedVenda.clientId] || "Consumidor"}</div>
          <div class="divider"></div>
          <table>
            <thead><tr><th>Qtd</th><th>Produto</th><th class="right">Total</th></tr></thead>
            <tbody>
              ${vendaItens.map(item => `
                <tr>
                  <td>${item.quantidade}x</td>
                  <td>${item.nomeProduto}<br><small>R$ ${Number(item.precoUnitario).toFixed(2)}</small></td>
                  <td class="right">R$ ${Number(item.total).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="flex"><span>Subtotal:</span><span>R$ ${Number(selectedVenda.subtotal || 0).toFixed(2)}</span></div>
          <div class="flex"><span>Desconto:</span><span>R$ ${Number(selectedVenda.descontoTotal || 0).toFixed(2)}</span></div>
          <div class="flex bold" style="font-size: 14px; margin-top: 4px;"><span>TOTAL:</span><span>R$ ${Number(selectedVenda.total || 0).toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="flex"><span>Forma Pgto:</span><span>${selectedVenda.formaPagamento || "Não informada"}</span></div>
          <div class="divider"></div>
          <div class="center" style="margin-top: 10px;">Obrigado pela preferência!</div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
        </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Breadcrumb simulado */}
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline" onClick={() => router.push("/")}>Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Vendas</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">Histórico</span>
      </div>

      {/* Header Clássico ERP */}
      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-sidebar-foreground" /> Vendas Realizadas
        </h1>
      </div>

      {/* Toolbar ERP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-1">
          <Button 
            className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]" 
            onClick={() => router.push("/pdv")}
          >
            <Receipt className="h-3.5 w-3.5" /> Novo Pedido (PDV)
          </Button>
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 rounded-sm w-full sm:w-[300px] border-gray-300 focus-visible:ring-0 focus-visible:border-primary text-[13px]"
            placeholder="Buscar por cliente ou ID da venda..."
          />
          <Button className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="bg-white border rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-foreground uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 font-semibold">Data/Hora</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold text-right">Subtotal</th>
                <th className="px-3 py-2 font-semibold text-right">Desconto</th>
                <th className="px-3 py-2 font-semibold text-right">Total</th>
                <th className="px-3 py-2 font-semibold text-center">Pagamento</th>
                <th className="px-3 py-2 font-semibold text-center">Status</th>
                <th className="px-3 py-2 font-semibold text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingVendas ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando histórico...
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                filteredVendas.map((venda) => (
                  <tr key={venda.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDate(venda.dataVenda)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-primary">
                      {clientesMap[venda.clientId] || "Consumidor não identificado"}
                    </td>
                    <td className="px-3 py-2.5 text-right">R$ {Number(venda.subtotal || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">R$ {Number(venda.descontoTotal || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">R$ {Number(venda.total || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant="outline" className="font-normal text-[11px] bg-slate-50">{venda.formaPagamento || "Não informada"}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-normal hover:bg-emerald-100 text-[11px]">{venda.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button 
                        title="Visualizar Detalhes" 
                        className="btn-erp-action-blue" 
                        onClick={() => handleViewVenda(venda)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes da Venda */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Detalhes da Venda</DialogTitle>
            <DialogDescription>ID: <span className="font-mono">{selectedVenda?.id}</span></DialogDescription>
          </DialogHeader>

          {selectedVenda && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-sm bg-gray-50">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><Calendar className="h-3 w-3" /> Data</p>
                  <p className="font-medium text-sm mt-1">{formatDate(selectedVenda.dataVenda)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><User className="h-3 w-3" /> Cliente</p>
                  <p className="font-medium text-sm mt-1">{clientesMap[selectedVenda.clientId] || "Desconhecido"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><CreditCard className="h-3 w-3" /> Pagamento</p>
                  <p className="font-medium text-sm mt-1">{selectedVenda.formaPagamento}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><DollarSign className="h-3 w-3" /> Total</p>
                  <p className="font-bold text-green-700 text-sm mt-1">R$ {Number(selectedVenda.total).toFixed(2)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-3">Itens do Pedido</h3>
                {isLoadingItens ? (
                  <div className="flex items-center gap-2 text-muted-foreground p-4 justify-center border rounded-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
                  </div>
                ) : (
                  <div className="border rounded-sm overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="p-2 font-semibold">Produto</th>
                          <th className="p-2 font-semibold text-center">Qtd</th>
                          <th className="p-2 font-semibold text-right">Preço Unit.</th>
                          <th className="p-2 font-semibold text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendaItens.map(item => (
                          <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="p-2 font-medium text-primary">{item.nomeProduto}</td>
                            <td className="p-2 text-center">{item.quantidade}x</td>
                            <td className="p-2 text-right">R$ {Number(item.precoUnitario).toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">R$ {Number(item.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 text-sm bg-muted/20 p-4 rounded-sm border">
                <Button variant="outline" className="w-full sm:w-auto hover:bg-slate-100" onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Comprovante
                </Button>
                <div className="flex justify-end gap-6 w-full sm:w-auto">
                  <div className="text-right">
                    <p className="text-muted-foreground mb-1">Subtotal:</p>
                    <p className="text-red-600 mb-1">Desconto:</p>
                    <p className="font-bold text-base mt-2">TOTAL:</p>
                  </div>
                  <div className="text-right font-medium">
                    <p className="mb-1">R$ {Number(selectedVenda.subtotal || 0).toFixed(2)}</p>
                    <p className="text-red-600 mb-1">- R$ {Number(selectedVenda.descontoTotal || 0).toFixed(2)}</p>
                    <p className="font-bold text-base text-green-700 mt-2">R$ {Number(selectedVenda.total || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}