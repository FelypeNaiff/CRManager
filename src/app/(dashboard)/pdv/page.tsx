"use client"

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc, 
  Timestamp, 
  where, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  History, 
  Search, 
  Eye, 
  Loader2, 
  Receipt, 
  Calendar, 
  CreditCard, 
  User, 
  DollarSign, 
  Printer, 
  Plus, 
  Trash2, 
  Baby, 
  Wallet, 
  AlertCircle, 
  Check, 
  Sparkles 
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useProfile } from "@/lib/contexts/profile-context"
import { format } from "date-fns"

export default function VendasPage() {
  const router = useRouter()
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"

  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("novo")
  
  // Estados para o modal de detalhes
  const [selectedVenda, setSelectedVenda] = useState<any>(null)
  const [vendaItens, setVendaItens] = useState<any[]>([])
  const [isLoadingItens, setIsLoadingItens] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // CRM Integration States
  const [buscarWhats, setBuscarWhats] = useState("")
  const [foundClient, setFoundClient] = useState<any>(null)
  const [clientChildren, setClientChildren] = useState<any[]>([])
  const [clientWallet, setClientWallet] = useState<any>(null)
  const [clientLastSale, setClientLastSale] = useState<any>(null)
  const [isLoadingCrmData, setIsLoadingCrmData] = useState(false)
  const [selectedFilhoId, setSelectedFilhoId] = useState("")
  
  // Balance utilization states
  const [usarSaldo, setUsarSaldo] = useState(false)
  const [saldoUtilizado, setSaldoUtilizado] = useState(0)

  // Quick register states inside PDV
  const [isQuickRegisterOpen, setIsQuickRegisterOpen] = useState(false)
  const [quickRegisterForm, setQuickRegisterForm] = useState({
    nome: "",
    cpf: "",
    whatsapp: "",
    filhoNome: "",
    filhoIdade: ""
  })
  const [isSavingQuickRegister, setIsSavingQuickRegister] = useState(false)

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
    return db ? query(collection(db, "clientes"), where("tenant_id", "==", tenantId), where("deleted_at", "==", null)) : null
  }, [db, tenantId])
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

  // Automatically fetch customer details when selected via dropdown
  useEffect(() => {
    async function loadClientCrmDetails() {
      const clientId = novoPedido.cliente
      if (!clientId || !db) {
        setFoundClient(null)
        setClientChildren([])
        setClientWallet(null)
        setClientLastSale(null)
        setUsarSaldo(false)
        setSaldoUtilizado(0)
        return
      }

      if (foundClient?.id === clientId) return

      const client = clientes?.find((c: any) => c.id === clientId)
      if (!client) return

      setFoundClient(client)
      setIsLoadingCrmData(true)
      try {
        // 1. Fetch Children
        const kidsSnap = await getDocs(query(collection(db, "filhos"), where("cliente_id", "==", clientId), where("status", "==", "ativo")))
        setClientChildren(kidsSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        // 2. Fetch Wallet
        const walletSnap = await getDocs(query(collection(db, "carteiras_clientes"), where("cliente_id", "==", clientId)))
        if (!walletSnap.empty) {
          setClientWallet({ id: walletSnap.docs[0].id, ...walletSnap.docs[0].data() })
        } else {
          setClientWallet(null)
        }

        // 3. Fetch Last Sale
        const salesSnap = await getDocs(query(collection(db, "vendas"), where("clientId", "==", clientId)))
        if (!salesSnap.empty) {
          const sortedSales = salesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .sort((a, b) => (b.dataVenda?.seconds || 0) - (a.dataVenda?.seconds || 0))
          setClientLastSale(sortedSales[0])
        } else {
          setClientLastSale(null)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoadingCrmData(false)
      }
    }
    loadClientCrmDetails()
  }, [novoPedido.cliente, db, clientes])

  // Search by WhatsApp Handler
  const handleSearchWhatsapp = async () => {
    if (!buscarWhats || !db) return
    const cleanWhats = buscarWhats.replace(/\D/g, "")
    if (cleanWhats.length < 8) {
      toast({ variant: "destructive", title: "Erro", description: "Informe um número de WhatsApp válido." })
      return
    }

    setIsLoadingCrmData(true)
    try {
      const client = clientes?.find((c: any) => {
        const c1 = (c.whatsapp_principal || c.whatsapp || "").replace(/\D/g, "")
        const c2 = (c.whatsapp_secundario || "").replace(/\D/g, "")
        return c1.includes(cleanWhats) || c2.includes(cleanWhats)
      })

      if (client) {
        setNovoPedido(p => ({ ...p, cliente: client.id }))
        toast({ title: "Cliente localizado!", description: `Selecionado: ${client.nome}` })
      } else {
        setFoundClient(null)
        setClientChildren([])
        setClientWallet(null)
        setClientLastSale(null)
        setNovoPedido(p => ({ ...p, cliente: null }))
        toast({ 
          variant: "destructive", 
          title: "Cliente não localizado", 
          description: "WhatsApp não cadastrado. Use o botão de Cadastro Rápido." 
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingCrmData(false)
    }
  }

  // Open Quick Register Form populated with searched number
  const handleOpenQuickRegister = () => {
    const cleanWhats = buscarWhats.replace(/\D/g, "")
    setQuickRegisterForm({
      nome: "",
      cpf: "",
      whatsapp: cleanWhats,
      filhoNome: "",
      filhoIdade: ""
    })
    setIsQuickRegisterOpen(true)
  }

  // Save Quick Register inside PDV
  const handleSaveQuickRegister = async () => {
    if (!quickRegisterForm.nome.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Nome é obrigatório" })
    }
    if (!quickRegisterForm.whatsapp.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "WhatsApp é obrigatório" })
    }
    if (!db) return

    setIsSavingQuickRegister(true)
    try {
      const cleanWhats = quickRegisterForm.whatsapp.replace(/\D/g, "")
      
      // 1. Create client document
      const clientRef = await addDoc(collection(db, "clientes"), {
        nome: quickRegisterForm.nome,
        cpf: quickRegisterForm.cpf.replace(/\D/g, ""),
        whatsapp_principal: cleanWhats,
        whatsapp: cleanWhats,
        vip: false,
        status: "ativo",
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: activeProfile?.nome || "Vendedor PDV"
      })

      // 2. Create customer Wallet
      await addDoc(collection(db, "carteiras_clientes"), {
        cliente_id: clientRef.id,
        saldo_atual: 0,
        total_creditos_gerados: 0,
        total_creditos_utilizados: 0,
        total_creditos_expirados: 0,
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date(),
        status: "ativo"
      })

      // 3. Create Child if named
      if (quickRegisterForm.filhoNome.trim()) {
        const idadeAnos = parseInt(quickRegisterForm.filhoIdade) || 0
        const anoNasc = new Date().getFullYear() - idadeAnos
        const dataNasc = `${anoNasc}-06-15` // default mid-year

        await addDoc(collection(db, "filhos"), {
          cliente_id: clientRef.id,
          nome: quickRegisterForm.filhoNome,
          data_nascimento: dataNasc,
          status: "ativo",
          tenant_id: tenantId,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      toast({ title: "Cliente cadastrado!", description: "Cliente já selecionado para a venda." })
      setNovoPedido(p => ({ ...p, cliente: clientRef.id }))
      setBuscarWhats(cleanWhats)
      setIsQuickRegisterOpen(false)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível cadastrar." })
    } finally {
      setIsSavingQuickRegister(false)
    }
  }

  // Format date helper
  const formatDate = (timestamp: any) => {
    if (!timestamp || !timestamp.seconds) return "-"
    return new Date(timestamp.seconds * 1000).toLocaleString("pt-BR")
  }

  // Modal details loader
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

  // Receipt printable styling
  const handlePrintReceipt = () => {
    if (!selectedVenda) return

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      toast({ variant: "destructive", title: "Erro", description: "O bloqueador de pop-ups impediu a impressão." })
      return
    }

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
          ${selectedVenda.saldoUtilizado > 0 ? `
            <div class="flex"><span>Pago c/ Saldo:</span><span>- R$ ${Number(selectedVenda.saldoUtilizado).toFixed(2)}</span></div>
          ` : ""}
          <div class="flex bold" style="font-size: 14px; margin-top: 4px;"><span>PAGO FINAL:</span><span>R$ ${Number(selectedVenda.total || 0).toFixed(2)}</span></div>
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

  // Add Item to sale cart
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

  // Dynamic values calculation including wallet usage
  const calcularTotaisPedido = () => {
    const subtotal = novoPedido.itens.reduce((acc: number, item: any) => acc + item.total, 0)
    const desconto = parseFloat(novoPedido.desconto || 0)
    const subtotalComDesconto = Math.max(0, subtotal - desconto)
    
    // Max balance that can be deducted
    const maxSaldoAplicavel = Math.min(clientWallet?.saldo_atual || 0, subtotalComDesconto)
    const saldoFinalUsado = usarSaldo ? Math.min(saldoUtilizado, maxSaldoAplicavel) : 0
    const total = Math.max(0, subtotalComDesconto - saldoFinalUsado)

    return { subtotal, desconto, subtotalComDesconto, saldoFinalUsado, total }
  }

  // Save and process complete sale
  const salvarNovoPedido = async () => {
    if (!novoPedido.cliente) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione ou busque um cliente" })
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
      const { subtotal, desconto, subtotalComDesconto, saldoFinalUsado, total } = calcularTotaisPedido()

      // 1. Create sale document in Firestore
      const vendaRef = await addDoc(collection(db, "vendas"), {
        clientId: novoPedido.cliente,
        filhoId: selectedFilhoId || null,
        vendedorId: novoPedido.vendedor,
        dataVenda: Timestamp.now(),
        subtotal,
        descontoTotal: desconto,
        saldoUtilizado: saldoFinalUsado,
        total,
        formaPagamento: novoPedido.formaPagamento,
        observacoes: novoPedido.observacoes,
        status: "concluída",
        criadoEm: Timestamp.now(),
        tenant_id: tenantId
      })

      // 2. Add sale subcollection items
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

        // 3. Decrement active product stock
        const prodRef = doc(db, "produtos", item.produtoId)
        const prodSnap = await getDoc(prodRef)
        if (prodSnap.exists()) {
          const currentStock = Number(prodSnap.data().estoqueAtual ?? prodSnap.data().estoque ?? 0)
          await updateDoc(prodRef, {
            estoqueAtual: Math.max(0, currentStock - Number(item.quantidade))
          })
        }
      }

      // 4. Create paid Accounts Receivable entry in finance ledger
      await addDoc(collection(db, "accounts_receivable"), {
        description: `Venda PDV #${vendaRef.id.substring(0, 8)}`,
        amount: total,
        dueDate: format(new Date(), "yyyy-MM-dd"),
        clientId: novoPedido.cliente,
        clientName: foundClient?.nome || "Cliente Avulso",
        status: "PAID",
        receiptDate: format(new Date(), "yyyy-MM-dd"),
        receivedAmount: total,
        documentNumber: vendaRef.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        tenant_id: tenantId
      })

      // 5. Create Cash Income/Financial Transaction log
      await addDoc(collection(db, "financial_transactions"), {
        type: "INCOME",
        amount: total,
        date: format(new Date(), "yyyy-MM-dd"),
        description: `Venda Balcão #${vendaRef.id.substring(0, 8)}`,
        status: "COMPLETED",
        referenceId: vendaRef.id,
        referenceType: "vendas",
        createdAt: Timestamp.now(),
        tenant_id: tenantId
      })

      // 6. Record in Client timeline logs
      const filhoObj = clientChildren.find(f => f.id === selectedFilhoId)
      const filhoDesc = filhoObj ? ` (para o filho ${filhoObj.nome})` : ""
      await addDoc(collection(db, "historico_cliente"), {
        cliente_id: novoPedido.cliente,
        tipo_acao: "Compra PDV",
        descricao: `Realizou compra de ${novoPedido.itens.length} produtos no PDV${filhoDesc}. Total: R$ ${total.toFixed(2)} (Pago com Saldo: R$ ${saldoFinalUsado.toFixed(2)}).`,
        created_at: new Date(),
        status: "ativo",
        tenant_id: tenantId
      })

      // 7. Deduct wallet balance if credit was used
      if (saldoFinalUsado > 0 && clientWallet) {
        const saldoAnterior = clientWallet.saldo_atual || 0
        const saldoPosterior = Math.max(0, saldoAnterior - saldoFinalUsado)

        await updateDoc(doc(db, "carteiras_clientes", clientWallet.id), {
          saldo_atual: saldoPosterior,
          total_creditos_utilizados: (clientWallet.total_creditos_utilizados || 0) + saldoFinalUsado,
          ultima_movimentacao: Timestamp.now()
        })

        // Log decrement in wallet ledger
        await addDoc(collection(db, "movimentacoes_saldo"), {
          cliente_id: novoPedido.cliente,
          carteira_id: clientWallet.id,
          tipo_movimentacao: "SAIDA",
          origem: "VENDA",
          valor: saldoFinalUsado,
          saldo_anterior: saldoAnterior,
          saldo_posterior: saldoPosterior,
          venda_id: vendaRef.id,
          usuario_responsavel: activeProfile?.nome || "Balcão PDV",
          observacao: `Saldo abatido na compra PDV Venda #${vendaRef.id.substring(0, 8)}`,
          created_at: Timestamp.now(),
          tenant_id: tenantId
        })
      }

      // 8. Feed automatic segmentations / tags
      if (foundClient) {
        const tagsAtivas = foundClient.tags || []
        if (!tagsAtivas.includes("comprador_pdv")) {
          await updateDoc(doc(db, "clientes", foundClient.id), {
            tags: [...tagsAtivas, "comprador_pdv"]
          })
        }
      }

      toast({ 
        title: "Venda concluída!", 
        description: `Pedido #${vendaRef.id.substring(0, 8)} salvo. Estoques e saldos recalculados.`
      })

      // Reset cart and customer lookup states
      setNovoPedido({
        cliente: null,
        vendedor: null,
        itens: [],
        desconto: 0,
        formaPagamento: "dinheiro",
        observacoes: ""
      })
      setBuscarWhats("")
      setFoundClient(null)
      setClientChildren([])
      setClientWallet(null)
      setClientLastSale(null)
      setSelectedFilhoId("")
      setUsarSaldo(false)
      setSaldoUtilizado(0)
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
      {/* Breadcrumb */}
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline" onClick={() => router.push("/")}>Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Vendas</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">PDV Integrado CRM</span>
      </div>

      {/* Header */}
      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Receipt className="h-5 w-5 text-indigo-600 animate-pulse" /> Ponto de Venda Balcão · Trupe Kids
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="novo" className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" /> Novo Pedido
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de Vendas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* LEFT COLUMN: CUSTOMER WHATSAPP SEARCH & DETAILS & VENDEDOR & PRODUCTS */}
            <div className="space-y-4">
              
              {/* WhatsApp Lookup Card */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-600" /> Buscar Cliente (WhatsApp)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="WhatsApp (ex: 11999999999)"
                        value={buscarWhats}
                        onChange={e => setBuscarWhats(e.target.value)}
                        className="h-9 text-[13px] pr-8"
                        onKeyDown={e => e.key === "Enter" && handleSearchWhatsapp()}
                      />
                      {buscarWhats && (
                        <button 
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                          onClick={() => { setBuscarWhats(""); setNovoPedido(p => ({ ...p, cliente: null })); }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <Button 
                      onClick={handleSearchWhatsapp} 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-3 text-[13px]"
                      disabled={isLoadingCrmData}
                    >
                      {isLoadingCrmData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Fallback Selector */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Ou selecione na lista</span>
                    <Select value={novoPedido.cliente || ""} onValueChange={(value) => setNovoPedido({ ...novoPedido, cliente: value })}>
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue placeholder="Selecione um cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes?.map((cliente: any) => (
                          <SelectItem key={cliente.id} value={cliente.id} className="text-[13px]">
                            {cliente.nome} ({cliente.whatsapp_principal})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Customer display when active */}
                  {foundClient ? (
                    <div className="bg-slate-50 border rounded-lg p-3 space-y-2 text-xs text-slate-600 mt-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-800 font-bold text-sm block">{foundClient.nome}</strong>
                        {foundClient.vip && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-semibold border-amber-200">VIP ★</Badge>}
                      </div>

                      {/* Display wallet info */}
                      <div className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-sm mt-1">
                        <span className="text-slate-400 font-medium flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-indigo-500" /> Saldo Créditos:</span>
                        <strong className="text-indigo-600 text-[13px]">R$ {clientWallet?.saldo_atual?.toFixed(2) || "0.00"}</strong>
                      </div>

                      {/* Select associated Child */}
                      {clientChildren.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase block">Filho associado a esta compra</label>
                          <select 
                            value={selectedFilhoId}
                            onChange={e => setSelectedFilhoId(e.target.value)}
                            className="w-full h-8 px-2 border rounded bg-white text-xs text-slate-700 focus:outline-none"
                          >
                            <option value="">Não associar a nenhum filho...</option>
                            {clientChildren.map(f => (
                              <option key={f.id} value={f.id}>{f.nome} ({new Date().getFullYear() - new Date(f.data_nascimento).getFullYear()} anos)</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block mt-1">Sem filhos cadastrados no perfil</span>
                      )}

                      {/* Last sale details */}
                      {clientLastSale && (
                        <div className="text-[10px] text-slate-400 bg-white border border-slate-100 p-2 rounded-sm mt-1 flex justify-between">
                          <span>Última Compra:</span>
                          <strong>R$ {clientLastSale.total?.toFixed(2)} ({formatDate(clientLastSale.dataVenda).split(" ")[0]})</strong>
                        </div>
                      )}

                      {/* Obs importants */}
                      {foundClient.observacoes && (
                        <div className="bg-yellow-50 text-yellow-800 border border-yellow-100 p-2 rounded-sm text-[10px] mt-1">
                          <strong>Obs Importante:</strong> {foundClient.observacoes}
                        </div>
                      )}
                    </div>
                  ) : buscarWhats && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                        Nenhum cliente com este número.
                      </div>
                      <Button 
                        onClick={handleOpenQuickRegister} 
                        className="bg-rose-600 hover:bg-rose-700 text-white w-full h-8 text-[11px] font-bold"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Cadastro Rápido de Cliente
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vendedor Card */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" /> Vendedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={novoPedido.vendedor || ""} onValueChange={(value) => setNovoPedido({ ...novoPedido, vendedor: value })}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Selecione o atendente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios?.map((usuario: any) => (
                        <SelectItem key={usuario.id} value={usuario.id} className="text-[13px]">
                          {usuario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Product search */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-500" /> Adicionar Produto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input 
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    placeholder="Código de barras ou nome do produto..."
                    className="h-9 text-[13px]"
                  />
                  
                  {buscaProduto && (
                    <div className="max-h-32 overflow-y-auto border rounded-sm divide-y">
                      {produtos?.filter((p: any) => {
                        const term = buscaProduto.toLowerCase()
                        return p.nome?.toLowerCase().includes(term) || p.codigo?.toLowerCase().includes(term)
                      }).map((produto: any) => (
                        <div 
                          key={produto.id}
                          className={`p-2 text-xs cursor-pointer hover:bg-slate-50 flex justify-between items-center ${
                            selectedProductoId === produto.id ? 'bg-indigo-50/50' : ''
                          }`}
                          onClick={() => setSelectedProductoId(produto.id)}
                        >
                          <div>
                            <strong className="font-medium text-slate-700">{produto.nome}</strong>
                            <span className="text-muted-foreground block text-[10px]">Cód: {produto.codigo || 'N/A'} | Estoque: {Number(produto.estoqueAtual ?? produto.estoque ?? 0).toFixed(0)}</span>
                          </div>
                          <span className="font-bold text-slate-800">R$ {Number(produto.preco || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Selected product parameters form */}
              {selectedProductoId && (
                <Card className="border-indigo-200 bg-indigo-50/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Configurar Item
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Quantidade</label>
                        <Input 
                          type="number" 
                          value={quantidadeProduto}
                          onChange={(e) => setQuantidadeProduto(e.target.value)}
                          className="h-9 text-[13px]"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Desconto Item</label>
                        <div className="flex gap-1">
                          <Input 
                            type="number" 
                            value={descontoItem}
                            onChange={(e) => setDescontoItem(e.target.value)}
                            className="h-9 text-[13px] flex-1"
                            min="0"
                          />
                          <select 
                            value={tipoDescontoItem} 
                            onChange={e => setTipoDescontoItem(e.target.value)}
                            className="h-9 border rounded px-1 bg-white text-xs text-slate-600"
                          >
                            <option value="R$">R$</option>
                            <option value="%">%</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={adicionarItemAoPedido}
                      className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[13px] gap-2 font-semibold"
                    >
                      <Plus className="h-4 w-4" /> Incluir no Carrinho
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* CENTRAL COLUMN: CART SHOPPING LIST */}
            <div className="space-y-4">
              <Card className="border shadow-sm h-full flex flex-col">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Carrinho de Compras</span>
                    <Badge variant="secondary">{novoPedido.itens.length} Itens</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col justify-between">
                  {novoPedido.itens.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
                      <Receipt className="h-8 w-8 text-slate-300" />
                      O carrinho está vazio. Adicione produtos ao lado.
                    </div>
                  ) : (
                    <div className="divide-y max-h-[500px] overflow-y-auto">
                      {novoPedido.itens.map((item: any) => (
                        <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 text-xs">
                          <div className="space-y-1">
                            <strong className="font-bold text-slate-800 block">{item.nomeProduto}</strong>
                            <span className="text-slate-400 block text-[10px]">Unitário: R$ {item.precoUnitario.toFixed(2)} {item.descontoValor > 0 ? `| Desc: ${item.tipoDesconto === "%" ? `${item.descontoValor}%` : `R$ ${item.descontoValor}`}` : ""}</span>
                            <span className="text-slate-500 font-medium">Quantidade: {item.quantidade}x</span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <strong className="text-slate-800 text-sm">R$ {item.total.toFixed(2)}</strong>
                            <button
                              onClick={() => removerItemDoPedido(item.id)}
                              className="text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors"
                              title="Remover produto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: DISCOUNTS, WALLET DEDUCTION & CHECKOUT METRICS */}
            <div className="space-y-4">
              
              {/* Payment details */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-500" /> Forma de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={novoPedido.formaPagamento} onValueChange={(value) => setNovoPedido({ ...novoPedido, formaPagamento: value })}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro" className="text-[13px]">Dinheiro</SelectItem>
                      <SelectItem value="credito" className="text-[13px]">Cartão de Crédito</SelectItem>
                      <SelectItem value="debito" className="text-[13px]">Cartão de Débito</SelectItem>
                      <SelectItem value="pix" className="text-[13px]">PIX (Instantâneo)</SelectItem>
                      <SelectItem value="boleto" className="text-[13px]">Boleto Bancário</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase block">Desconto Geral no Total (R$)</label>
                    <Input 
                      type="number"
                      value={novoPedido.desconto}
                      onChange={e => setNovoPedido({ ...novoPedido, desconto: Number(e.target.value) })}
                      className="h-9 text-[13px]"
                      min="0"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Wallet Integration box */}
              {foundClient && clientWallet && clientWallet.saldo_atual > 0 && (
                <Card className="border-emerald-200 bg-emerald-50/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                        <Wallet className="h-4 w-4 text-emerald-600" /> Utilizar Saldo da Carteira?
                      </CardTitle>
                      <Switch 
                        checked={usarSaldo}
                        onCheckedChange={checked => {
                          setUsarSaldo(checked)
                          if (checked) {
                            const { subtotalComDesconto } = calcularTotaisPedido()
                            setSaldoUtilizado(Math.min(clientWallet.saldo_atual || 0, subtotalComDesconto))
                          } else {
                            setSaldoUtilizado(0)
                          }
                        }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-3 text-xs">
                    <p className="text-emerald-700 text-[10px]">O cliente possui <strong>R$ {clientWallet.saldo_atual.toFixed(2)}</strong> em créditos acumulados por trocas/ajustes.</p>
                    
                    {usarSaldo && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-emerald-800 uppercase block">Valor a abater do saldo (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          className="bg-white border-emerald-200 h-9"
                          max={clientWallet.saldo_atual}
                          value={saldoUtilizado}
                          onChange={e => {
                            const { subtotalComDesconto } = calcularTotaisPedido()
                            const val = Math.min(Number(e.target.value), clientWallet.saldo_atual, subtotalComDesconto)
                            setSaldoUtilizado(val)
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Checkout Summary Details */}
              {(() => {
                const { subtotal, desconto, subtotalComDesconto, saldoFinalUsado, total } = calcularTotaisPedido()
                const saldoRestante = clientWallet ? Math.max(0, (clientWallet.saldo_atual || 0) - saldoFinalUsado) : 0

                return (
                  <>
                    <Card className="bg-gradient-to-br from-indigo-50 to-slate-50 border-indigo-100 shadow-sm text-xs">
                      <CardHeader className="pb-2 border-b border-indigo-100/50">
                        <CardTitle className="text-sm font-bold text-slate-800">Resumo da Venda</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Subtotal Carrinho:</span>
                          <span className="font-semibold text-slate-700">R$ {subtotal.toFixed(2)}</span>
                        </div>
                        {desconto > 0 && (
                          <div className="flex justify-between items-center text-rose-600">
                            <span>Desconto Aplicado:</span>
                            <span className="font-semibold">- R$ {desconto.toFixed(2)}</span>
                          </div>
                        )}
                        {saldoFinalUsado > 0 && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span>Crédito Abatido:</span>
                            <span className="font-semibold">- R$ {saldoFinalUsado.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200/50 pt-2 mt-2 flex justify-between items-center">
                          <span className="font-bold text-slate-800 text-sm">TOTAL A PAGAR:</span>
                          <span className="font-bold text-base text-indigo-700">R$ {total.toFixed(2)}</span>
                        </div>
                        {usarSaldo && saldoFinalUsado > 0 && (
                          <div className="border-t border-dashed border-emerald-200 pt-2 mt-1 text-[10px] text-emerald-700 flex justify-between">
                            <span>Saldo Restante na Carteira:</span>
                            <strong className="font-bold">R$ {saldoRestante.toFixed(2)}</strong>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Button 
                        onClick={salvarNovoPedido}
                        disabled={isLoadingNovoPedido || novoPedido.itens.length === 0 || !novoPedido.cliente || !novoPedido.vendedor}
                        className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold gap-2 text-sm shadow-sm"
                      >
                        {isLoadingNovoPedido ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Finalizando Venda...
                          </>
                        ) : (
                          <>
                            <Receipt className="h-5 w-5" /> Confirmar & Baixar Venda
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => location.reload()}
                        disabled={isLoadingNovoPedido}
                        className="w-full h-9 rounded text-xs text-slate-500 border-slate-200"
                      >
                        Limpar Formulário
                      </Button>
                    </div>
                  </>
                )
              })()}

            </div>

          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <HistoricoVendasTab
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            vendas={vendas}
            clientes={clientes}
            clientesMap={clientesMap}
            isLoadingVendas={isLoadingVendas}
            formatDate={formatDate}
            handleViewVenda={handleViewVenda}
            router={router}
          />
        </TabsContent>
      </Tabs>

      {/* MODAL CADASTRO RAPIDO DE CLIENTE */}
      <Dialog open={isQuickRegisterOpen} onOpenChange={setIsQuickRegisterOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" /> Cadastro Rápido de Cliente
            </DialogTitle>
            <DialogDescription>
              Insira as informações básicas de cadastro rápido do responsável e do filho para vinculação imediata ao balcão de vendas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold text-slate-600">Nome Completo *</Label>
              <Input
                placeholder="Nome do Comprador Responsável"
                value={quickRegisterForm.nome}
                onChange={e => setQuickRegisterForm(p => ({ ...p, nome: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-slate-600">WhatsApp *</Label>
                <Input
                  placeholder="DDD + Número"
                  value={quickRegisterForm.whatsapp}
                  onChange={e => setQuickRegisterForm(p => ({ ...p, whatsapp: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-slate-600">CPF (Opcional)</Label>
                <Input
                  placeholder="Somente números"
                  value={quickRegisterForm.cpf}
                  onChange={e => setQuickRegisterForm(p => ({ ...p, cpf: e.target.value }))}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block">👶 Informações do Filho (Opcional)</span>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Nome do Filho</Label>
                  <Input
                    placeholder="Nome da criança"
                    value={quickRegisterForm.filhoNome}
                    onChange={e => setQuickRegisterForm(p => ({ ...p, filhoNome: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Idade (Anos)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 5"
                    value={quickRegisterForm.filhoIdade}
                    onChange={e => setQuickRegisterForm(p => ({ ...p, filhoIdade: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 gap-2">
            <Button variant="outline" onClick={() => setIsQuickRegisterOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              onClick={handleSaveQuickRegister}
              disabled={isSavingQuickRegister}
            >
              {isSavingQuickRegister && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e Selecionar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Venda */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold"><Receipt className="h-5 w-5 text-indigo-600" /> Detalhes da Venda</DialogTitle>
            <DialogDescription>ID: <span className="font-mono">{selectedVenda?.id}</span></DialogDescription>
          </DialogHeader>

          {selectedVenda && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-xl bg-slate-50/50">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Data</p>
                  <p className="font-medium text-slate-800 text-sm mt-1">{formatDate(selectedVenda.dataVenda)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><User className="h-3.5 w-3.5" /> Cliente</p>
                  <p className="font-medium text-slate-800 text-sm mt-1">{clientesMap[selectedVenda.clientId] || "Desconhecido"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Pagamento</p>
                  <p className="font-medium text-slate-800 text-sm mt-1 uppercase">{selectedVenda.formaPagamento}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Pago Final</p>
                  <p className="font-bold text-emerald-700 text-sm mt-1">R$ {Number(selectedVenda.total).toFixed(2)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-700 text-xs mb-3 uppercase tracking-wider">Itens do Pedido</h3>
                {isLoadingItens ? (
                  <div className="flex items-center gap-2 text-muted-foreground p-4 justify-center border rounded-lg bg-slate-50/40">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Carregando produtos...
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="p-3 font-semibold text-slate-600">Produto</th>
                          <th className="p-3 font-semibold text-slate-600 text-center">Quantidade</th>
                          <th className="p-3 font-semibold text-slate-600 text-right">Preço Unitário</th>
                          <th className="p-3 font-semibold text-slate-600 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vendaItens.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/30">
                            <td className="p-3 font-medium text-indigo-600">{item.nomeProduto}</td>
                            <td className="p-3 text-center text-slate-700">{item.quantidade}x</td>
                            <td className="p-3 text-right text-slate-500">R$ {Number(item.precoUnitario).toFixed(2)}</td>
                            <td className="p-3 text-right font-semibold text-slate-800">R$ {Number(item.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <Button variant="outline" className="w-full sm:w-auto hover:bg-slate-100 h-9" onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 mr-2 text-slate-500" />
                  Imprimir Comprovante
                </Button>
                <div className="flex justify-end gap-6 w-full sm:w-auto text-xs">
                  <div className="text-right text-slate-500 space-y-1">
                    <p>Subtotal:</p>
                    <p className="text-red-600">Desconto:</p>
                    {selectedVenda.saldoUtilizado > 0 && <p className="text-emerald-600 font-medium">Saldo Carteira:</p>}
                    <p className="font-bold text-slate-800 text-sm mt-2">TOTAL PAGO:</p>
                  </div>
                  <div className="text-right font-medium text-slate-800 space-y-1">
                    <p>R$ {Number(selectedVenda.subtotal || 0).toFixed(2)}</p>
                    <p className="text-red-600">- R$ {Number(selectedVenda.descontoTotal || 0).toFixed(2)}</p>
                    {selectedVenda.saldoUtilizado > 0 && <p className="text-emerald-600">- R$ {Number(selectedVenda.saldoUtilizado).toFixed(2)}</p>}
                    <p className="font-bold text-sm text-emerald-700 mt-2">R$ {Number(selectedVenda.total || 0).toFixed(2)}</p>
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
  const filteredVendas = useMemo(() => {
    if (!vendas) return []
    if (!searchTerm) return vendas
    const lowerSearch = searchTerm.toLowerCase()
    return vendas.filter((v: any) => {
      const clienteNome = clientesMap[v.clientId]?.toLowerCase() || ""
      return clienteNome.includes(lowerSearch) || v.id.toLowerCase().includes(lowerSearch)
    })
  }, [vendas, clientesMap, searchTerm])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border rounded-lg shadow-sm text-xs">
        <div className="flex items-center gap-1">
          <Button 
            className="bg-emerald-600 hover:bg-emerald-500 gap-1 h-8 rounded px-3 text-white font-medium" 
            onClick={() => location.reload()}
          >
            <Plus className="h-3.5 w-3.5" /> Novo Pedido PDV
          </Button>
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 rounded w-full sm:w-[300px] border-slate-300 focus-visible:ring-1 focus-visible:ring-indigo-500 text-xs"
            placeholder="Buscar por cliente ou ID da venda..."
          />
          <Button className="bg-slate-800 hover:bg-slate-700 text-white h-8 w-8 p-0 rounded shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-slate-600 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Data/Hora</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold text-right">Subtotal</th>
                <th className="px-4 py-3 font-semibold text-right">Desconto</th>
                <th className="px-4 py-3 font-semibold text-right">Abat. Saldo</th>
                <th className="px-4 py-3 font-semibold text-right">Total Pago</th>
                <th className="px-4 py-3 font-semibold text-center">Pagamento</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingVendas ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando histórico...
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                filteredVendas.map((venda: any) => (
                  <tr key={venda.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(venda.dataVenda)}
                    </td>
                    <td className="px-4 py-3 font-medium text-indigo-600">
                      {clientesMap[venda.clientId] || "Consumidor não identificado"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">R$ {Number(venda.subtotal || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">R$ {Number(venda.descontoTotal || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">R$ {Number(venda.saldoUtilizado || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">R$ {Number(venda.total || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="font-normal bg-slate-50 text-[10px] uppercase">{venda.formaPagamento || "Não informada"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-normal hover:bg-emerald-50 text-[10px]">{venda.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        title="Visualizar Detalhes" 
                        className="bg-indigo-50 text-indigo-600 p-1.5 rounded hover:bg-indigo-100 transition-colors" 
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