"use client"

export const dynamic = 'force-dynamic'

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, getDocs, addDoc, Timestamp } from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { History, Search, Eye, Loader2, Receipt, Calendar, CreditCard, User, DollarSign, Printer, Plus, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function VendasPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("novo")
  
  // Estados para o modal de detalhes
  const [selectedVenda, setSelectedVenda] = useState<any>(null)
  const [vendaItens, setVendaItens] = useState<any[]>([])
  const [isLoadingItens, setIsLoadingItens] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Estados para novo pedido
  const [novoPedido, setNovoPedido] = useState<any>({
    cliente: null,
    vendedor: null,
    itens: [],
    desconto: 0,
    formaPagamento: "dinheiro",
    observacoes: ""
  })
  const [isLoadingNovoPedido, setIsLoadingNovoPedido] = useState(false)
  const [selectedProductoId, setSelectedProductoId] = useState("")
  const [quantidadeProduto, setQuantidadeProduto] = useState("1")
  const [buscaProduto, setBuscaProduto] = useState("")
  const [descontoItem, setDescontoItem] = useState("0")
  const [tipoDescontoItem, setTipoDescontoItem] = useState("R$") // "R$" ou "%"

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

  // Carrega os produtos para o novo pedido
  const produtosQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "produtos")) : null
  }, [db])
  const { data: produtos } = useCollection(produtosQuery)

  // Carrega os usuários/vendedores
  const usuariosQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "usuarios")) : null
  }, [db])
  const { data: usuarios } = useCollection(usuariosQuery)

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

  // Funções para novo pedido
  const adicionarItemAoPedido = () => {
    if (!selectedProductoId || !quantidadeProduto) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um produto e informe a quantidade" })
      return
    }

    const produto = produtos?.find((p: any) => p.id === selectedProductoId)
    if (!produto) {
      toast({ variant: "destructive", title: "Erro", description: "Produto não encontrado" })
      return
    }

    const quantidade = parseInt(quantidadeProduto)
    const estoque = Number(produto.estoqueAtual ?? produto.estoque ?? 0)

    if (estoque <= 0) {
      toast({ variant: "destructive", title: "Erro", description: "Produto sem estoque disponível" })
      return
    }

    if (quantidade > estoque) {
      toast({ variant: "destructive", title: "Erro", description: `Quantidade solicitada (${quantidade}) maior que o estoque disponível (${estoque})` })
      return
    }

    const precoUnitario = produto.preco || 0
    const descontoValor = parseFloat(descontoItem || "0")
    let precoComDesconto = precoUnitario

    if (tipoDescontoItem === "%") {
      precoComDesconto = precoUnitario * (1 - descontoValor / 100)
    } else {
      precoComDesconto = precoUnitario - descontoValor
    }

    if (precoComDesconto < 0) precoComDesconto = 0

    const total = quantidade * precoComDesconto

    const novoItem = {
      id: `${selectedProductoId}-${Date.now()}`,
      produtoId: selectedProductoId,
      nomeProduto: produto.nome,
      codigoProduto: produto.codigo || "",
      precoUnitario: precoUnitario,
      precoComDesconto: precoComDesconto,
      descontoValor: descontoValor,
      tipoDesconto: tipoDescontoItem,
      quantidade,
      total,
      estoqueDisponivel: estoque
    }

    setNovoPedido({
      ...novoPedido,
      itens: [...novoPedido.itens, novoItem]
    })

    setSelectedProductoId("")
    setQuantidadeProduto("1")
    setBuscaProduto("")
    setDescontoItem("0")
    setTipoDescontoItem("R$")
    toast({ title: "Sucesso", description: "Produto adicionado ao pedido" })
  }

  const removerItemDoPedido = (itemId: string) => {
    setNovoPedido({
      ...novoPedido,
      itens: novoPedido.itens.filter((item: any) => item.id !== itemId)
    })
  }

  const calcularTotaisPedido = () => {
    const subtotal = novoPedido.itens.reduce((acc: number, item: any) => acc + item.total, 0)
    const desconto = parseFloat(novoPedido.desconto || 0)
    const total = subtotal - desconto
    return { subtotal, desconto, total }
  }

  const salvarNovoPedido = async () => {
    if (!novoPedido.cliente) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um cliente" })
      return
    }

    if (!novoPedido.vendedor) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um vendedor" })
      return
    }

    if (novoPedido.itens.length === 0) {
      toast({ variant: "destructive", title: "Erro", description: "Adicione pelo menos um item ao pedido" })
      return
    }

    if (!db) return

    setIsLoadingNovoPedido(true)
    try {
      const { subtotal, desconto, total } = calcularTotaisPedido()

      const vendaRef = await addDoc(collection(db, "vendas"), {
        clientId: novoPedido.cliente,
        vendedorId: novoPedido.vendedor,
        dataVenda: Timestamp.now(),
        subtotal,
        descontoTotal: desconto,
        total,
        formaPagamento: novoPedido.formaPagamento,
        observacoes: novoPedido.observacoes,
        status: "concluída",
        criadoEm: Timestamp.now()
      })

      // Salva os itens da venda
      for (const item of novoPedido.itens) {
        await addDoc(collection(db, `vendas/${vendaRef.id}/venda_itens`), {
          produtoId: item.produtoId,
          nomeProduto: item.nomeProduto,
          codigoProduto: item.codigoProduto,
          precoUnitario: item.precoUnitario,
          precoComDesconto: item.precoComDesconto,
          descontoValor: item.descontoValor,
          tipoDesconto: item.tipoDesconto,
          quantidade: item.quantidade,
          total: item.total
        })
      }

      toast({ 
        title: "Sucesso", 
        description: `Pedido #${vendaRef.id} criado com sucesso!`,
        variant: "default"
      })

      // Reseta o pedido
      setNovoPedido({
        cliente: null,
        vendedor: null,
        itens: [],
        desconto: 0,
        formaPagamento: "dinheiro",
        observacoes: ""
      })

      // Muda para aba de histórico
      setActiveTab("historico")
    } catch (error) {
      console.error("Erro ao salvar pedido:", error)
      toast({ variant: "destructive", title: "Erro", description: "Erro ao salvar o pedido" })
    } finally {
      setIsLoadingNovoPedido(false)
    }
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Breadcrumb simulado */}
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline" onClick={() => router.push("/")}>Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Vendas</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">PDV</span>
      </div>

      {/* Header Clássico ERP */}
      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Receipt className="h-5 w-5 text-sidebar-foreground" /> Ponto de Venda
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="novo" className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Pedido
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de Vendas
          </TabsTrigger>
        </TabsList>

        {/* Aba: Novo Pedido */}
        <TabsContent value="novo" className="space-y-4">
          <NovoPedidoTab
            novoPedido={novoPedido}
            setNovoPedido={setNovoPedido}
            clientes={clientes}
            produtos={produtos}
            usuarios={usuarios}
            selectedProductoId={selectedProductoId}
            setSelectedProductoId={setSelectedProductoId}
            quantidadeProduto={quantidadeProduto}
            setQuantidadeProduto={setQuantidadeProduto}
            buscaProduto={buscaProduto}
            setBuscaProduto={setBuscaProduto}
            descontoItem={descontoItem}
            setDescontoItem={setDescontoItem}
            tipoDescontoItem={tipoDescontoItem}
            setTipoDescontoItem={setTipoDescontoItem}
            adicionarItemAoPedido={adicionarItemAoPedido}
            removerItemDoPedido={removerItemDoPedido}
            calcularTotaisPedido={calcularTotaisPedido}
            salvarNovoPedido={salvarNovoPedido}
            isLoadingNovoPedido={isLoadingNovoPedido}
          />
        </TabsContent>

        {/* Aba: Histórico */}
        <TabsContent value="historico" className="space-y-4">
          <HistoricoVendasTab
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            vendas={vendas}
            clientes={clientes}
            clientesMap={createClientesMap(clientes)}
            isLoadingVendas={isLoadingVendas}
            formatDate={formatDate}
            handleViewVenda={handleViewVenda}
            router={router}
          />
        </TabsContent>
      </Tabs>

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
                  <p className="font-medium text-sm mt-1">{createClientesMap(clientes)[selectedVenda.clientId] || "Desconhecido"}</p>
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

// Função auxiliar
function createClientesMap(clientes: any[] | null) {
  const map: Record<string, string> = {}
  if (clientes) {
    clientes.forEach(c => {
      map[c.id] = c.nome || c.razaoSocial || "Cliente sem nome"
    })
  }
  return map
}

// Componente: Aba de Novo Pedido
function NovoPedidoTab({
  novoPedido,
  setNovoPedido,
  clientes,
  produtos,
  usuarios,
  selectedProductoId,
  setSelectedProductoId,
  quantidadeProduto,
  setQuantidadeProduto,
  buscaProduto,
  setBuscaProduto,
  descontoItem,
  setDescontoItem,
  tipoDescontoItem,
  setTipoDescontoItem,
  adicionarItemAoPedido,
  removerItemDoPedido,
  calcularTotaisPedido,
  salvarNovoPedido,
  isLoadingNovoPedido
}: any) {
  const { subtotal, desconto, total } = calcularTotaisPedido()

  // Filtrar produtos por busca
  const produtosFiltrados = produtos?.filter((produto: any) => {
    const termo = buscaProduto.toLowerCase()
    return produto.nome?.toLowerCase().includes(termo) || 
           produto.codigo?.toLowerCase().includes(termo)
  }) || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Coluna esquerda: Cliente, Vendedor e Busca de Produtos */}
      <div className="space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={novoPedido.cliente || ""} onValueChange={(value) => setNovoPedido({ ...novoPedido, cliente: value })}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clientes?.map((cliente: any) => (
                  <SelectItem key={cliente.id} value={cliente.id} className="text-[13px]">
                    {cliente.nome || cliente.razaoSocial || "Cliente sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Vendedor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={novoPedido.vendedor || ""} onValueChange={(value) => setNovoPedido({ ...novoPedido, vendedor: value })}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder="Selecione um vendedor..." />
              </SelectTrigger>
              <SelectContent>
                {usuarios?.map((usuario: any) => (
                  <SelectItem key={usuario.id} value={usuario.id} className="text-[13px]">
                    {usuario.nome || usuario.email || "Usuário sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Busca de Produtos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" /> Buscar Produto
            </CardTitle>
            <CardDescription className="text-xs">Digite código ou nome do produto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input 
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              placeholder="Código ou nome do produto..."
              className="h-9 text-[13px]"
            />
            
            {buscaProduto && (
              <div className="max-h-32 overflow-y-auto border rounded-sm">
                {produtosFiltrados.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">Nenhum produto encontrado</div>
                ) : (
                  produtosFiltrados.map((produto: any) => (
                    <div 
                      key={produto.id}
                      className={`p-2 text-xs cursor-pointer hover:bg-gray-50 border-b last:border-0 ${
                        selectedProductoId === produto.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedProductoId(produto.id)}
                    >
                      <div className="font-medium">{produto.nome}</div>
                      <div className="text-muted-foreground">
                        Código: {produto.codigo || 'N/A'} | 
                        Preço: R$ {Number(produto.preco || 0).toFixed(2)} | 
                        Estoque: {Number(produto.estoqueAtual ?? produto.estoque ?? 0).toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuração do Item */}
        {selectedProductoId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configurar Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Quantidade</label>
                <Input 
                  type="number" 
                  value={quantidadeProduto}
                  onChange={(e) => setQuantidadeProduto(e.target.value)}
                  placeholder="1"
                  className="h-9 text-[13px]"
                  min="1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Desconto por Item</label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={descontoItem}
                    onChange={(e) => setDescontoItem(e.target.value)}
                    placeholder="0"
                    className="h-9 text-[13px]"
                    step="0.01"
                    min="0"
                  />
                  <Select value={tipoDescontoItem} onValueChange={setTipoDescontoItem}>
                    <SelectTrigger className="h-9 w-16 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R$" className="text-[13px]">R$</SelectItem>
                      <SelectItem value="%" className="text-[13px]">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={adicionarItemAoPedido}
                className="w-full h-9 bg-green-600 hover:bg-green-700 text-white rounded-sm text-[13px] gap-2"
              >
                <Plus className="h-4 w-4" /> Adicionar ao Pedido
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Coluna central: Itens do Pedido */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            {novoPedido.itens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum item adicionado ainda
              </div>
            ) : (
              <div className="border rounded-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-xs h-8">Produto</TableHead>
                      <TableHead className="text-xs h-8 text-center">Qtd</TableHead>
                      <TableHead className="text-xs h-8 text-right">Preço</TableHead>
                      <TableHead className="text-xs h-8 text-right">Desc</TableHead>
                      <TableHead className="text-xs h-8 text-right">Total</TableHead>
                      <TableHead className="text-xs h-8 text-center w-12">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novoPedido.itens.map((item: any) => (
                      <TableRow key={item.id} className="text-xs h-8">
                        <TableCell className="py-2">
                          <div className="font-medium">{item.nomeProduto}</div>
                          <div className="text-muted-foreground text-[10px]">{item.codigoProduto}</div>
                        </TableCell>
                        <TableCell className="py-2 text-center">{item.quantidade}x</TableCell>
                        <TableCell className="py-2 text-right">R$ {Number(item.precoUnitario).toFixed(2)}</TableCell>
                        <TableCell className="py-2 text-right">
                          {item.descontoValor > 0 ? (
                            <span className="text-red-600">
                              {item.tipoDesconto === "%" ? `${item.descontoValor}%` : `R$ ${item.descontoValor}`}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right font-medium">R$ {Number(item.total).toFixed(2)}</TableCell>
                        <TableCell className="py-2 text-center">
                          <button
                            onClick={() => removerItemDoPedido(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Remover item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita: Totais e Finalização */}
      <div className="space-y-4">
        {/* Forma de Pagamento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Forma de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={novoPedido.formaPagamento} onValueChange={(value) => setNovoPedido({ ...novoPedido, formaPagamento: value })}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro" className="text-[13px]">Dinheiro</SelectItem>
                <SelectItem value="credito" className="text-[13px]">Cartão Crédito</SelectItem>
                <SelectItem value="debito" className="text-[13px]">Cartão Débito</SelectItem>
                <SelectItem value="pix" className="text-[13px]">PIX</SelectItem>
                <SelectItem value="boleto" className="text-[13px]">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea 
              value={novoPedido.observacoes}
              onChange={(e) => setNovoPedido({ ...novoPedido, observacoes: e.target.value })}
              placeholder="Adicione observações sobre o pedido..."
              className="w-full p-2 border border-gray-300 rounded-sm text-xs resize-none focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Totais */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Desconto:</span>
              <span className="font-medium text-red-600">- R$ {desconto.toFixed(2)}</span>
            </div>
            <div className="border-t border-emerald-200 pt-2 mt-2 flex justify-between items-center">
              <span className="font-bold text-base">TOTAL:</span>
              <span className="font-bold text-lg text-emerald-700">R$ {total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="space-y-2">
          <Button 
            onClick={salvarNovoPedido}
            disabled={isLoadingNovoPedido || novoPedido.itens.length === 0 || !novoPedido.cliente || !novoPedido.vendedor}
            className="w-full h-10 bg-green-600 hover:bg-green-700 text-white rounded-sm font-medium gap-2"
          >
            {isLoadingNovoPedido ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4" /> Concluir Pedido
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => location.reload()}
            disabled={isLoadingNovoPedido}
            className="w-full h-10 rounded-sm text-[13px]"
          >
            Limpar Formulário
          </Button>
        </div>
      </div>
    </div>
  )
}

// Componente: Aba de Histórico de Vendas
function HistoricoVendasTab({
  searchTerm,
  setSearchTerm,
  vendas,
  clientes,
  clientesMap,
  isLoadingVendas,
  formatDate,
  handleViewVenda,
  router
}: any) {
  // Precisa do useMemo aqui, então importamos React hooks
  const filteredVendas = vendas && searchTerm 
    ? vendas.filter((v: any) => {
        const clienteNome = clientesMap[v.clientId]?.toLowerCase() || ""
        const lowerSearch = searchTerm.toLowerCase()
        return clienteNome.includes(lowerSearch) || v.id.toLowerCase().includes(lowerSearch)
      })
    : vendas || []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border rounded-sm shadow-sm">
        <div className="flex items-center gap-1">
          <Button 
            className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]" 
            onClick={() => router.push("/pdv")}
          >
            <Plus className="h-3.5 w-3.5" /> Novo Pedido
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
                filteredVendas.map((venda: any) => (
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
    </div>
  )
}