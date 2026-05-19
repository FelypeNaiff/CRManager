"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Search, 
  UserPlus, 
  Filter, 
  MoreVertical, 
  Phone, 
  Mail, 
  MapPin, 
  Tag as TagIcon, 
  Loader2, 
  Baby, 
  History, 
  Wallet, 
  Repeat, 
  Pencil, 
  Trash2, 
  Plus, 
  AlertCircle,
  Eye,
  CheckCircle,
  Sparkles,
  Info,
  User,
  PlusCircle
} from "lucide-react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, where, getDocs, doc, writeBatch } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { useProfile } from "@/lib/contexts/profile-context"
import { CrmService } from "@/lib/crm-service"

// Standard Brazilian phone mask helper
function formatPhone(v: string): string {
  if (!v) return ""
  const digits = v.replace(/\D/g, "")
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
}

function calcIdade(dataNascimento: string): string {
  if (!dataNascimento) return ""
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()
  if (meses < 0) { anos--; meses += 12 }
  if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""} e ${meses} mês${meses !== 1 ? "es" : ""}`
  return `${meses} mês${meses !== 1 ? "es" : ""}`
}

const emptyFilhoForm = {
  nome: "",
  data_nascimento: "",
  sexo: "",
  tamanho_roupa: "2",
  tamanho_calcado: "",
  preferencia_estilo: "",
  cores_preferidas: "",
  personagens_preferidos: "",
  observacoes: "",
  status: "ativo" as "ativo" | "inativo" | "arquivado"
}

const emptyForm = {
  nome: "",
  cpf: "",
  whatsapp_principal: "",
  whatsapp_secundario: "",
  instagram: "",
  email: "",
  data_nascimento: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  origem: "Loja Física",
  vip: false,
  aceita_marketing: true,
  observacoes: "",
  status: "ativo" as "ativo" | "inativo" | "arquivado"
}

export default function ClientesPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"
  
  const searchParams = useSearchParams()

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ativo")

  useEffect(() => {
    const statusParam = searchParams?.get("status")
    if (statusParam) {
      setStatusFilter(statusParam)
    }
  }, [searchParams])

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  
  // Selected Customer state
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Forms state
  const [form, setForm] = useState(emptyForm)
  const [filhos, setFilhos] = useState<any[]>([])
  const [deletedFilhos, setDeletedFilhos] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Extra Details tabs states (loaded dynamically when opening details)
  const [historyLogs, setHistoryLogs] = useState<any[]>([])
  const [walletInfo, setWalletInfo] = useState<any>(null)
  const [walletHistory, setWalletHistory] = useState<any[]>([])

  // Dynamic ledger-calculated wallet balance
  const computedBalanceFromExtrato = useMemo(() => {
    if (!walletHistory || walletHistory.length === 0) return 0
    return walletHistory.reduce((acc, move) => {
      const val = move.valor || 0
      const isPositive = move.saldo_posterior > move.saldo_anterior || move.tipo_movimentacao === "ENTRADA" || move.tipo_movimentacao === "ESTORNO"
      return isPositive ? acc + val : acc - val
    }, 0)
  }, [walletHistory])
  const [returnsHistory, setReturnsHistory] = useState<any[]>([])
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Manual adjustment wallet state
  const [isAdjustingWallet, setIsAdjustingWallet] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustType, setAdjustType] = useState<"ENTRADA" | "SAIDA">("ENTRADA")
  const [adjustReason, setAdjustReason] = useState("")
  const [isSavingWallet, setIsSavingWallet] = useState(false)

  // Quick Child Addition & Size updates inside details abas
  const [isQuickAddFilhoOpen, setIsQuickAddFilhoOpen] = useState(false)
  const [isQuickSizeUpdateOpen, setIsQuickSizeUpdateOpen] = useState(false)
  const [selectedFilhoForUpdate, setSelectedFilhoForUpdate] = useState<any>(null)
  const [quickFilhoForm, setQuickFilhoForm] = useState(emptyFilhoForm)
  const [isSavingQuickFilho, setIsSavingQuickFilho] = useState(false)
  const [newTamanhoRoupa, setNewTamanhoRoupa] = useState("")
  const [newTamanhoCalcado, setNewTamanhoCalcado] = useState("")
  const [sizeUpdateReason, setSizeUpdateReason] = useState("")
  const [isSavingSizeUpdate, setIsSavingSizeUpdate] = useState(false)

  // Quick Customer child addition fields
  const [rapidoFilhoNome, setRapidoFilhoNome] = useState("")
  const [rapidoFilhoIdade, setRapidoFilhoIdade] = useState("")

  // Mapping client IDs to their wallet balances
  const [walletsMap, setWalletsMap] = useState<Record<string, number>>({})

  const handleSaveQuickFilho = async () => {
    if (!quickFilhoForm.nome.trim()) {
      return toast({ variant: "destructive", title: "Nome obrigatório", description: "Informe o nome da criança." })
    }
    if (!selectedCustomer) return

    setIsSavingQuickFilho(true)
    try {
      const dataToSave = {
        ...quickFilhoForm,
        cliente_id: selectedCustomer.id,
        tenant_id: tenantId,
        data_atualizacao_tamanho: new Date().toISOString()
      }

      await CrmService.createDocument(db, "filhos", dataToSave, activeProfile as any)

      // Add to timeline
      await CrmService.createDocument(db, "historico_cliente", {
        cliente_id: selectedCustomer.id,
        tipo_acao: "CADASTRO_FILHO",
        descricao: `Filho(a) ${quickFilhoForm.nome} cadastrado(a) com tamanho de roupa: ${quickFilhoForm.tamanho_roupa || 'Não informado'}`,
        tenant_id: tenantId
      }, activeProfile as any)

      toast({ title: "Filho cadastrado!", description: `${quickFilhoForm.nome} foi adicionado à ficha do cliente.` })
      
      // Reload children aba
      const kidsSnap = await getDocs(query(collection(db, "filhos"), where("cliente_id", "==", selectedCustomer.id)))
      setFilhos(kidsSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      const historySnap = await getDocs(query(collection(db, "historico_cliente"), where("cliente_id", "==", selectedCustomer.id)))
      setHistoryLogs(historySnap.docs.map(d => ({ id: d.id, ...d.data() }) as any).sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)))

      setIsQuickAddFilhoOpen(false)
      setQuickFilhoForm(emptyFilhoForm)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cadastrar filho" })
    } finally {
      setIsSavingQuickFilho(false)
    }
  }

  const handleSaveSizeUpdate = async () => {
    if (!selectedFilhoForUpdate) return
    if (!newTamanhoRoupa && !newTamanhoCalcado) {
      return toast({ variant: "destructive", title: "Campos vazios", description: "Informe ao menos um novo tamanho." })
    }
    if (!sizeUpdateReason.trim()) {
      return toast({ variant: "destructive", title: "Motivo obrigatório", description: "Escreva uma breve observação." })
    }

    setIsSavingSizeUpdate(true)
    try {
      const anteriorRoupa = selectedFilhoForUpdate.tamanho_roupa || "Não informado"
      const anteriorCalcado = selectedFilhoForUpdate.tamanho_calcado || "Não informado"

      const updatedFields: any = {
        data_atualizacao_tamanho: new Date().toISOString()
      }
      if (newTamanhoRoupa) updatedFields.tamanho_roupa = newTamanhoRoupa
      if (newTamanhoCalcado) updatedFields.tamanho_calcado = newTamanhoCalcado

      await CrmService.updateDocument(db, "filhos", selectedFilhoForUpdate.id, updatedFields, activeProfile as any)

      // Add timeline log
      const histText = `Tamanhos de ${selectedFilhoForUpdate.nome} atualizados. ` +
        (newTamanhoRoupa ? `Roupa: ${anteriorRoupa} → ${newTamanhoRoupa}. ` : "") +
        (newTamanhoCalcado ? `Calçado: ${anteriorCalcado} → ${newTamanhoCalcado}. ` : "") +
        `Motivo: ${sizeUpdateReason}`

      await CrmService.createDocument(db, "historico_cliente", {
        cliente_id: selectedCustomer.id,
        tipo_acao: "ATUALIZACAO_TAMANHO",
        descricao: histText,
        tenant_id: tenantId
      }, activeProfile as any)

      toast({ title: "Tamanhos atualizados!", description: "Histórico de tamanhos gravado com sucesso." })
      
      // Reload children and history
      const kidsSnap = await getDocs(query(collection(db, "filhos"), where("cliente_id", "==", selectedCustomer.id)))
      setFilhos(kidsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      
      const historySnap = await getDocs(query(collection(db, "historico_cliente"), where("cliente_id", "==", selectedCustomer.id)))
      setHistoryLogs(historySnap.docs.map(d => ({ id: d.id, ...d.data() }) as any).sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)))

      setIsQuickSizeUpdateOpen(false)
      setNewTamanhoRoupa("")
      setNewTamanhoCalcado("")
      setSizeUpdateReason("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar tamanhos" })
    } finally {
      setIsSavingSizeUpdate(false)
    }
  }

  const openQuickSizeUpdate = (filho: any) => {
    setSelectedFilhoForUpdate(filho)
    setNewTamanhoRoupa(filho.tamanho_roupa || "")
    setNewTamanhoCalcado(filho.tamanho_calcado || "")
    setSizeUpdateReason("")
    setIsQuickSizeUpdateOpen(true)
  }

  // 1. Fetch CRM Clients query
  const clientesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "clientes"),
      where("tenant_id", "==", tenantId),
      where("deleted_at", "==", null)
    )
  }, [db, tenantId])

  const { data: customers, isLoading, error } = useCollection(clientesQuery)

  const tabParam = searchParams?.get("tab")

  // Filter clients locally
  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    return customers.filter(c => {
      const matchSearch = 
        c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.whatsapp_principal?.includes(searchTerm) ||
        c.cpf?.replace(/\D/g, "").includes(searchTerm.replace(/\D/g, ""))
      
      const matchStatus = statusFilter === "todos" || c.status === statusFilter
      if (!matchSearch || !matchStatus) return false

      if (tabParam === "aniversariantes") {
        const dateField = c.data_nascimento || c.dataNascimento
        if (!dateField) return false
        const bdayMonth = new Date(dateField).getMonth() + 1
        const currentMonth = new Date().getMonth() + 1
        return bdayMonth === currentMonth
      }

      return true
    })
  }, [customers, searchTerm, statusFilter, tabParam])

  // Fetch initial tags and wallet mapping on mount
  useEffect(() => {
    async function loadTagsAndWallets() {
      if (!db) return
      try {
        const snap = await getDocs(query(collection(db, "tags"), where("tenant_id", "==", tenantId)))
        setAvailableTags(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error("Erro ao carregar tags:", e)
      }

      try {
        const wSnap = await getDocs(query(collection(db, "carteiras_clientes"), where("tenant_id", "==", tenantId)))
        const mapping: Record<string, number> = {}
        wSnap.docs.forEach(doc => {
          const data = doc.data()
          if (data.cliente_id) {
            mapping[data.cliente_id] = data.saldo_atual || 0
          }
        })
        setWalletsMap(mapping)
      } catch (e) {
        console.error("Erro ao carregar carteiras:", e)
      }
    }
    loadTagsAndWallets()
  }, [db, tenantId, isFormOpen, isDetailsOpen, customers])

  // Open creation dialog
  const [isCadastroRapido, setIsCadastroRapido] = useState(false)

  const handleOpenCreate = (rapido: boolean = false) => {
    setEditingCustomer(null)
    setForm(emptyForm)
    setFilhos([])
    setDeletedFilhos([])
    setIsCadastroRapido(rapido)
    setRapidoFilhoNome("")
    setRapidoFilhoIdade("")
    setIsFormOpen(true)
  }

  // Open edit dialog
  const handleOpenEdit = async (customer: any) => {
    setEditingCustomer(customer)
    setIsCadastroRapido(false)
    setForm({
      nome: customer.nome || "",
      cpf: customer.cpf || "",
      whatsapp_principal: customer.whatsapp_principal || "",
      whatsapp_secundario: customer.whatsapp_secundario || "",
      instagram: customer.instagram || "",
      email: customer.email || "",
      data_nascimento: customer.data_nascimento || "",
      endereco: customer.endereco || "",
      numero: customer.numero || "",
      complemento: customer.complemento || "",
      bairro: customer.bairro || "",
      cidade: customer.cidade || "",
      estado: customer.estado || "",
      cep: customer.cep || "",
      origem: customer.origem || "Loja Física",
      vip: !!customer.vip,
      aceita_marketing: customer.aceita_marketing !== false,
      observacoes: customer.observacoes || "",
      status: customer.status || "ativo"
    })
    
    // Load existing linked children
    try {
      const snap = await getDocs(query(collection(db, "filhos"), where("cliente_id", "==", customer.id)))
      setFilhos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setDeletedFilhos([])
    } catch (e) {
      console.error(e)
    }

    setIsFormOpen(true)
  }

  // Soft delete confirm
  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  // Open detailed tabbed view
  const handleOpenDetails = async (customer: any) => {
    setSelectedCustomer(customer)
    setIsDetailsOpen(true)
    
    // Load tabs data: children, history, wallet balance, wallet movements, tags
    try {
      // 1. Kids
      const kidsSnap = await getDocs(query(collection(db, "filhos"), where("cliente_id", "==", customer.id)))
      setFilhos(kidsSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // 2. Client history logs
      const historySnap = await getDocs(query(collection(db, "historico_cliente"), where("cliente_id", "==", customer.id)))
      setHistoryLogs(historySnap.docs.map(d => ({ id: d.id, ...d.data() }) as any).sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)))

      // 3. Wallet details
      const walletSnap = await getDocs(query(collection(db, "carteiras_clientes"), where("cliente_id", "==", customer.id)))
      if (!walletSnap.empty) {
        const wData = { id: walletSnap.docs[0].id, ...walletSnap.docs[0].data() }
        setWalletInfo(wData)

        // 4. Wallet movements
        const walletMovesSnap = await getDocs(query(collection(db, "movimentacoes_saldo"), where("carteira_id", "==", wData.id)))
        setWalletHistory(walletMovesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any).sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)))
      } else {
        setWalletInfo(null)
        setWalletHistory([])
      }

      // 5. Returns
      const returnsSnap = await getDocs(query(collection(db, "trocas_devolucoes"), where("cliente_id", "==", customer.id)))
      setReturnsHistory(returnsSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // 6. Selected Tags
      setSelectedTags(customer.tags || [])
      
    } catch (e) {
      console.error("Erro ao carregar detalhes do cliente:", e)
    }
  }

  // Kids sub-form operations
  const handleAddFilho = () => {
    setFilhos([...filhos, { nome: "", data_nascimento: "", sexo: "", tamanho_roupa: "2", tamanho_calcado: "", preferencia_estilo: "", status: "ativo" }])
  }

  const handleFilhoChange = (index: number, field: string, value: any) => {
    const newFilhos = [...filhos]
    newFilhos[index][field] = value
    setFilhos(newFilhos)
  }

  const handleRemoveFilho = (index: number) => {
    const newFilhos = [...filhos]
    const removed = newFilhos.splice(index, 1)[0]
    if (removed.id) {
      setDeletedFilhos([...deletedFilhos, removed.id])
    }
    setFilhos(newFilhos)
  }

  // Primary WhatsApp Unique verification and validation
  const validateWhatsappUnique = async (phone: string, excludeId?: string) => {
    if (!phone) return true
    const snap = await getDocs(
      query(collection(db, "clientes"), where("tenant_id", "==", tenantId), where("whatsapp_principal", "==", phone))
    )
    if (snap.empty) return true
    if (excludeId && snap.docs.length === 1 && snap.docs[0].id === excludeId) return true
    return false
  }

  // Save Cliente form (and linked Filhos)
  const handleSave = async () => {
    if (!form.nome.trim()) {
      return toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o nome completo." })
    }
    if (!form.whatsapp_principal.trim()) {
      return toast({ variant: "destructive", title: "WhatsApp obrigatório", description: "WhatsApp principal é de preenchimento obrigatório." })
    }

    const cleanWhatsapp = form.whatsapp_principal.replace(/\D/g, "")
    setIsSaving(true)

    try {
      // Unique verification
      const isUnique = await validateWhatsappUnique(cleanWhatsapp, editingCustomer?.id)
      if (!isUnique) {
        setIsSaving(false)
        return toast({ 
          variant: "destructive", 
          title: "WhatsApp Duplicado", 
          description: "Já existe um cliente cadastrado com este WhatsApp principal." 
        })
      }

      const clientData = {
        ...form,
        whatsapp_principal: cleanWhatsapp,
        whatsapp_secundario: form.whatsapp_secundario.replace(/\D/g, "")
      }

      let savedClient: any = null
      if (editingCustomer) {
        savedClient = await CrmService.updateDocument(db, "clientes", editingCustomer.id, clientData, activeProfile as any)
        toast({ title: "Cliente atualizado!", description: "Dados gravados com sucesso." })
      } else {
        savedClient = await CrmService.createDocument(db, "clientes", clientData, activeProfile as any)
        
        // Auto-create Wallet for new customer
        const walletRef = await CrmService.createDocument(db, "carteiras_clientes", {
          cliente_id: savedClient.id,
          saldo_atual: 0,
          total_creditos_gerados: 0,
          total_creditos_utilizados: 0,
          total_creditos_expirados: 0,
          ultima_movimentacao: new Date()
        }, activeProfile as any)

        // Auto-create history log for new customer
        await CrmService.createDocument(db, "historico_cliente", {
          cliente_id: savedClient.id,
          tipo_acao: "CADASTRO_CLIENTE",
          descricao: `Cliente ${form.nome} cadastrado na base de dados com carteira inicial preparada.`,
          tenant_id: tenantId
        }, activeProfile as any)

        toast({ title: "Cliente criado!", description: "Responsável cadastrado, carteira inicial criada e log de auditoria registrado." })
      }

      // Save/Update Filhos in batch
      const clientId = editingCustomer ? editingCustomer.id : savedClient.id
      let batchFilhos = [...filhos]

      if (isCadastroRapido && rapidoFilhoNome.trim()) {
        let dataNascCalculada = ""
        if (rapidoFilhoIdade) {
          const anos = Number(rapidoFilhoIdade)
          if (!isNaN(anos) && anos >= 0) {
            const anoNasc = new Date().getFullYear() - anos
            dataNascCalculada = `${anoNasc}-01-01`
          }
        }

        batchFilhos = [{
          nome: rapidoFilhoNome.trim(),
          data_nascimento: dataNascCalculada,
          sexo: "M",
          tamanho_roupa: "2",
          tamanho_calcado: "",
          preferencia_estilo: "",
          cores_preferidas: "",
          personagens_preferidos: "",
          observacoes: "",
          status: "ativo"
        }]
      }

      for (const filho of batchFilhos) {
        if (!filho.nome.trim()) continue
        const filhoData = {
          ...filho,
          cliente_id: clientId,
          tenant_id: tenantId
        }

        if (filho.id) {
          await CrmService.updateDocument(db, "filhos", filho.id, filhoData, activeProfile as any)
        } else {
          await CrmService.createDocument(db, "filhos", filhoData, activeProfile as any)

          // Auto-create history log for linked child creation in batch
          await CrmService.createDocument(db, "historico_cliente", {
            cliente_id: clientId,
            tipo_acao: "CADASTRO_FILHO",
            descricao: `Filho(a) ${filhoData.nome} cadastrado(a) e vinculado(a) ao responsável.`,
            tenant_id: tenantId
          }, activeProfile as any)
        }
      }

      // Process deleted kids
      for (const delId of deletedFilhos) {
        await CrmService.deleteDocument(db, "filhos", delId, activeProfile as any, true)
      }

      setIsFormOpen(false)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Ocorreu um erro ao gravar as alterações." })
    } finally {
      setIsSaving(false)
    }
  }

  // Soft delete executing
  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await CrmService.deleteDocument(db, "clientes", deletingId, activeProfile as any, false)
      toast({ title: "Cliente inativado", description: "O cliente foi movido para o arquivo." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setIsDeleteOpen(false)
      setDeletingId(null)
    }
  }

  // Manual adjustment wallet balance
  const handleSaveWalletAdjustment = async () => {
    if (!adjustAmount || Number(adjustAmount) <= 0) {
      return toast({ variant: "destructive", title: "Valor inválido" })
    }
    if (!adjustReason.trim()) {
      return toast({ variant: "destructive", title: "Observação obrigatória", description: "Você deve informar o motivo do ajuste manual." })
    }
    if (!walletInfo) return

    setIsSavingWallet(true)
    try {
      const valor = Number(adjustAmount)
      const saldoAnterior = walletInfo.saldo_atual || 0
      const saldoPosterior = adjustType === "ENTRADA" ? saldoAnterior + valor : saldoAnterior - valor

      if (saldoPosterior < 0) {
        setIsSavingWallet(false)
        return toast({ variant: "destructive", title: "Saldo negativo não permitido", description: "O saldo final não pode ser menor que zero." })
      }

      // 1. Create wallet movement
      await CrmService.createDocument(db, "movimentacoes_saldo", {
        cliente_id: selectedCustomer.id,
        carteira_id: walletInfo.id,
        tipo_movimentacao: adjustType,
        origem: "AJUSTE_MANUAL",
        valor: valor,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
        usuario_responsavel: activeProfile?.nome || "System",
        observacao: adjustReason
      }, activeProfile as any)

      // 2. Update wallet totals
      const updatedWallet = {
        saldo_atual: saldoPosterior,
        total_creditos_gerados: adjustType === "ENTRADA" ? (walletInfo.total_creditos_gerados || 0) + valor : (walletInfo.total_creditos_gerados || 0),
        total_creditos_utilizados: adjustType === "SAIDA" ? (walletInfo.total_creditos_utilizados || 0) + valor : (walletInfo.total_creditos_utilizados || 0),
        ultima_movimentacao: new Date()
      }
      await CrmService.updateDocument(db, "carteiras_clientes", walletInfo.id, updatedWallet, activeProfile as any)

      toast({ title: "Saldo ajustado!", description: `Carteira atualizada com sucesso.` })
      
      // Reload details tab to show changes
      handleOpenDetails(selectedCustomer)
      
      // Close adjustment form
      setIsAdjustingWallet(false)
      setAdjustAmount("")
      setAdjustReason("")
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro ao processar ajuste" })
    } finally {
      setIsSavingWallet(false)
    }
  }

  // Update client tags list
  const handleUpdateTags = async (tagNome: string) => {
    if (!selectedCustomer) return
    let updated: string[] = []
    if (selectedTags.includes(tagNome)) {
      updated = selectedTags.filter(t => t !== tagNome)
    } else {
      updated = [...selectedTags, tagNome]
    }
    
    try {
      await CrmService.updateDocument(db, "clientes", selectedCustomer.id, { tags: updated }, activeProfile as any)
      setSelectedTags(updated)
      toast({ title: "Tags atualizadas" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar tags" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <User className="h-8 w-8 text-indigo-600" /> Clientes & Responsáveis
          </h1>
          <p className="text-muted-foreground text-sm">Controle completo de compradores, vínculo de filhos, tags e extrato de saldo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="border-indigo-100 text-indigo-600 hover:bg-indigo-50/50 gap-2 h-10 font-semibold" onClick={() => handleOpenCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Cadastro Rápido
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-500 gap-2 text-white h-10 font-semibold shadow-sm" onClick={() => handleOpenCreate(false)}>
            <UserPlus className="h-4 w-4" /> Cadastro Completo
          </Button>
        </div>
      </div>

      {/* Search & Tabs status */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, WhatsApp ou CPF..."
            className="pl-10 h-10 bg-slate-50/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativo">Somente Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
              <SelectItem value="arquivado">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customers List Grid */}
      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
          <div>
            <h3 className="font-semibold text-base">Erro na base</h3>
            <p className="text-sm">{(error as any).message || "Consulte as permissões de acesso do Firestore."}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-2" />
          <p className="text-muted-foreground text-sm">Carregando carteira de clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50">
          <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-slate-600 font-semibold text-base">Nenhum cliente localizado</p>
          <p className="text-muted-foreground text-sm mt-1">Refine a busca ou adicione um novo registro de responsável.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="overflow-hidden border border-slate-100 shadow-sm hover:border-indigo-500/30 group hover:shadow-md transition-all duration-300 bg-white">
              <CardHeader className="p-4 pb-1 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-lg ${customer.vip ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                    {customer.nome?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-sm text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{customer.nome}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge className="text-[9px] h-4" variant={customer.status === "ativo" ? "default" : "secondary"}>
                        {customer.status}
                      </Badge>
                      {customer.vip && <Badge className="bg-amber-500 text-white text-[9px] h-4">★ VIP</Badge>}
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenDetails(customer)}>
                      <Eye className="mr-2 h-4 w-4 text-indigo-500" /> Detalhes / Abas
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenEdit(customer)}>
                      <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar Dados
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-rose-600 cursor-pointer" onClick={() => handleOpenDelete(customer.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Inativar Cliente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              
              <CardContent className="p-4 pt-3 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{formatPhone(customer.whatsapp_principal)}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-slate-500 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.cidade && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{customer.cidade} - {customer.estado}</span>
                    </div>
                  )}
                </div>

                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {customer.tags.map((tg: string) => (
                      <Badge key={tg} variant="outline" className="text-[9px] h-4 bg-slate-50 text-slate-600">
                        {tg}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-indigo-500" /> Saldo
                  </span>
                  <strong className="text-xs font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-md border border-indigo-100/30">
                    R$ {(walletsMap[customer.id] || 0).toFixed(2)}
                  </strong>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ADD/EDIT DIALOG */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              {editingCustomer ? "Editar Registro do Cliente" : isCadastroRapido ? "Cadastro Rápido de Cliente" : "Novo Cliente Responsável"}
            </DialogTitle>
            <DialogDescription>
              {isCadastroRapido 
                ? "Insira apenas o nome e WhatsApp do comprador principal para iniciar a venda rapidamente." 
                : "Insira as informações completas do comprador. Você também poderá vincular filhos nesta tela."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fnome">Nome Completo *</Label>
                <Input 
                  id="fnome" 
                  value={form.nome} 
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} 
                  placeholder="Ex: Amanda Maria dos Santos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fcpf">CPF</Label>
                <Input 
                  id="fcpf" 
                  value={form.cpf} 
                  onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} 
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fwhatsapp">WhatsApp Principal (Busca única) *</Label>
                <Input 
                  id="fwhatsapp" 
                  value={form.whatsapp_principal} 
                  onChange={e => setForm(p => ({ ...p, whatsapp_principal: e.target.value }))} 
                  placeholder="(00) 00000-0000"
                />
              </div>

              {isCadastroRapido && (
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-semibold text-xs text-slate-700 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                    <Baby className="h-4 w-4 text-indigo-500" /> Informações do Filho (Opcional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="frapidonome" className="text-xs text-slate-500">Nome do Filho</Label>
                      <Input 
                        id="frapidonome" 
                        value={rapidoFilhoNome} 
                        onChange={e => setRapidoFilhoNome(e.target.value)} 
                        placeholder="Ex: Amanda dos Santos"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frapidoidade" className="text-xs text-slate-500">Idade (Anos)</Label>
                      <Input 
                        id="frapidoidade" 
                        type="number"
                        min={0}
                        value={rapidoFilhoIdade} 
                        onChange={e => setRapidoFilhoIdade(e.target.value)} 
                        placeholder="Ex: 5"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {!isCadastroRapido && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fwhatsapp2">WhatsApp Secundário</Label>
                    <Input 
                      id="fwhatsapp2" 
                      value={form.whatsapp_secundario} 
                      onChange={e => setForm(p => ({ ...p, whatsapp_secundario: e.target.value }))} 
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="finsta">Instagram</Label>
                    <Input 
                      id="finsta" 
                      value={form.instagram} 
                      onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} 
                      placeholder="@usuario"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="femail">E-mail</Label>
                    <Input 
                      id="femail" 
                      value={form.email} 
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))} 
                      placeholder="cliente@provedor.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fnasc">Data de Nascimento</Label>
                    <Input 
                      id="fnasc" 
                      type="date" 
                      value={form.data_nascimento} 
                      onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))} 
                    />
                  </div>

                  {/* Endereço */}
                  <div className="md:col-span-2 border-t pt-4 mt-2">
                    <h4 className="font-semibold text-sm text-slate-800 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-indigo-500" /> Endereço de Entrega/Cobrança
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-2 col-span-2 sm:col-span-3">
                        <Label htmlFor="fend">Endereço (Rua/Avenida)</Label>
                        <Input id="fend" value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} placeholder="Rua..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fnum">Número</Label>
                        <Input id="fnum" value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="123" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fcomp">Complemento</Label>
                        <Input id="fcomp" value={form.complemento} onChange={e => setForm(p => ({ ...p, complemento: e.target.value }))} placeholder="Apto, Sala..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fbairro">Bairro</Label>
                        <Input id="fbairro" value={form.bairro} onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))} placeholder="Bairro..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fcid">Cidade</Label>
                        <Input id="fcid" value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} placeholder="Macapá" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fest">Estado</Label>
                        <Input id="fest" value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} placeholder="AP" maxLength={2} />
                      </div>
                    </div>
                  </div>

                  {/* CRM Options */}
                  <div className="md:col-span-2 border-t pt-4 mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50/50">
                      <div className="flex flex-col">
                        <Label className="text-sm font-semibold">Cliente VIP</Label>
                        <span className="text-[10px] text-muted-foreground">Destacar em relatórios</span>
                      </div>
                      <Switch checked={form.vip} onCheckedChange={v => setForm(p => ({ ...p, vip: v }))} />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50/50">
                      <div className="flex flex-col">
                        <Label className="text-sm font-semibold">Marketing WhatsApp</Label>
                        <span className="text-[10px] text-muted-foreground">Aceita receber ofertas</span>
                      </div>
                      <Switch checked={form.aceita_marketing} onCheckedChange={v => setForm(p => ({ ...p, aceita_marketing: v }))} />
                    </div>

                    <div className="space-y-1">
                      <Label>Origem do Cliente</Label>
                      <Select value={form.origem} onValueChange={v => setForm(p => ({ ...p, origem: v }))}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Origem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Loja Física">Loja Física</SelectItem>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="Indicação">Indicação</SelectItem>
                          <SelectItem value="Campanha">Campanha</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="fobs">Observações Internas</Label>
                    <Textarea 
                      id="fobs" 
                      value={form.observacoes} 
                      onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} 
                      placeholder="Restrições, gostos ou notas sobre o atendimento..."
                    />
                  </div>
                </>
              )}
            </div>

            {/* Linked Kids Panel */}
            {/* Linked Kids Panel */}
            {!isCadastroRapido && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Baby className="h-5 w-5 text-indigo-600" /> Filhos Vinculados
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Determine o perfil da criança para auxiliar campanhas futuras e tamanhos.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50/50" onClick={handleAddFilho}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Filho
                  </Button>
                </div>

                {filhos.length === 0 ? (
                  <div className="text-center p-6 border rounded-xl bg-slate-50/40 text-muted-foreground text-xs">
                    Nenhuma criança cadastrada para este responsável.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filhos.map((f, index) => (
                      <div key={index} className="p-4 border rounded-xl bg-slate-50/50 grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome da Criança</Label>
                          <Input value={f.nome} onChange={e => handleFilhoChange(index, "nome", e.target.value)} placeholder="Nome..." />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Nascimento</Label>
                            {f.data_nascimento && <span className="text-[10px] text-indigo-600 font-semibold">{calcIdade(f.data_nascimento)}</span>}
                          </div>
                          <Input type="date" value={f.data_nascimento} onChange={e => handleFilhoChange(index, "data_nascimento", e.target.value)} />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Sexo</Label>
                          <Select value={f.sexo} onValueChange={v => handleFilhoChange(index, "sexo", v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Sexo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Menino</SelectItem>
                              <SelectItem value="F">Menina</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Tamanho de Roupa</Label>
                          <Select value={f.tamanho_roupa} onValueChange={v => handleFilhoChange(index, "tamanho_roupa", v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Tamanho" />
                            </SelectTrigger>
                            <SelectContent>
                              {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-2 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRemoveFilho(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCustomer ? "Salvar Alterações" : "Criar Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE DIALOG */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-slate-800">Inativar Cliente Responsável</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja arquivar e inativar o registro deste cliente? Ele não aparecerá nas buscas padrão de vendas e CRM, mas seus históricos e saldos serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500" onClick={handleDelete}>
              Confirmar Inativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DETAILS VIEW WITH INTEGRATED TABS */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader className="border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold text-xl">
                  {selectedCustomer?.nome?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-800">{selectedCustomer?.nome}</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">WhatsApp: {formatPhone(selectedCustomer?.whatsapp_principal)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedCustomer?.vip && <Badge className="bg-amber-500 text-white">★ VIP</Badge>}
                <Badge variant={selectedCustomer?.status === "ativo" ? "default" : "secondary"}>{selectedCustomer?.status}</Badge>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 bg-slate-100 p-1 rounded-lg h-auto">
              <TabsTrigger value="dados" className="text-xs py-2">Dados</TabsTrigger>
              <TabsTrigger value="filhos" className="text-xs py-2">Filhos</TabsTrigger>
              <TabsTrigger value="historico" className="text-xs py-2">Histórico</TabsTrigger>
              <TabsTrigger value="carteira" className="text-xs py-2">Carteira</TabsTrigger>
              <TabsTrigger value="trocas" className="text-xs py-2">Trocas</TabsTrigger>
              <TabsTrigger value="tags" className="text-xs py-2">Tags</TabsTrigger>
              <TabsTrigger value="obs" className="text-xs py-2">Obs</TabsTrigger>
            </TabsList>

            {/* TAB DADOS */}
            <TabsContent value="dados" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 border rounded-xl">
                  <p className="text-slate-400 font-medium">Nome Completo</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedCustomer?.nome}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-slate-400 font-medium">CPF</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedCustomer?.cpf || "Não informado"}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-slate-400 font-medium">WhatsApp Principal</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{formatPhone(selectedCustomer?.whatsapp_principal)}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-slate-400 font-medium">WhatsApp Secundário</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{formatPhone(selectedCustomer?.whatsapp_secundario) || "Não informado"}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-slate-400 font-medium">E-mail</p>
                  <p className="text-sm font-bold text-slate-800 mt-1 truncate">{selectedCustomer?.email || "Não informado"}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-slate-400 font-medium">Instagram</p>
                  <p className="text-sm font-bold text-indigo-600 mt-1">{selectedCustomer?.instagram || "Não informado"}</p>
                </div>
                <div className="p-3 border rounded-xl col-span-2">
                  <p className="text-slate-400 font-medium">Endereço Principal</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">
                    {selectedCustomer?.endereco ? `${selectedCustomer.endereco}, ${selectedCustomer.numero}` : "Sem endereço cadastrado"}
                    {selectedCustomer?.bairro ? ` - ${selectedCustomer.bairro}` : ""}
                    {selectedCustomer?.cidade ? ` - ${selectedCustomer.cidade}/${selectedCustomer.estado}` : ""}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB FILHOS */}
            <TabsContent value="filhos" className="space-y-4 py-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Baby className="h-5 w-5 text-indigo-600" /> Perfil das Crianças
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Cada perfil gerencia tamanhos, idades e preferências segmentadas.</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 gap-1.5 h-8 text-xs font-semibold"
                  onClick={() => {
                    setQuickFilhoForm(emptyFilhoForm)
                    setIsQuickAddFilhoOpen(true)
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Adicionar Filho
                </Button>
              </div>

              {filhos.length === 0 ? (
                <div className="text-center py-10 border rounded-xl bg-slate-50/50 text-slate-500 text-xs">
                  Sem perfil de filhos cadastrados. Clique no botão acima para adicionar um filho.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filhos.map((f, idx) => (
                    <Card key={idx} className="border shadow-none rounded-xl bg-slate-50/10 hover:bg-slate-50/30 transition-colors">
                      <CardHeader className="p-4 flex flex-row items-start justify-between gap-3 pb-2">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${f.sexo === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                            {f.nome?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                              {f.nome}
                              <Badge className={`text-[9px] px-1.5 py-0 ${f.sexo === 'F' ? 'bg-pink-100 text-pink-700 hover:bg-pink-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}`}>
                                {f.sexo === 'F' ? 'F' : 'M'}
                              </Badge>
                            </h4>
                            {f.data_nascimento && <span className="text-[10px] text-muted-foreground block mt-0.5">{calcIdade(f.data_nascimento)} ({new Date(f.data_nascimento).toLocaleDateString('pt-BR')})</span>}
                          </div>
                        </div>

                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Atualização Rápida de Tamanho"
                          onClick={() => openQuickSizeUpdate(f)}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2 border-t pt-3">
                          <div className="p-2 bg-white rounded-lg border flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-medium">Roupa</span>
                            <span className="font-bold text-slate-700 text-sm mt-0.5">{f.tamanho_roupa || "Não inf."}</span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-medium">Calçado</span>
                            <span className="font-bold text-slate-700 text-sm mt-0.5">{f.tamanho_calcado || "Não inf."}</span>
                          </div>
                        </div>

                        <div className="space-y-1 mt-2">
                          <p className="text-[10px] text-slate-400 font-medium">Preferências e Estilo</p>
                          <div className="space-y-1 bg-white p-2 rounded-lg border text-[11px] text-slate-600">
                            {f.preferencia_estilo && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Estilo:</span>
                                <span className="font-medium">{f.preferencia_estilo}</span>
                              </div>
                            )}
                            {f.cores_preferidas && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Cores:</span>
                                <span className="font-medium">{f.cores_preferidas}</span>
                              </div>
                            )}
                            {f.personagens_preferidos && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Personagens:</span>
                                <span className="font-medium">{f.personagens_preferidos}</span>
                              </div>
                            )}
                            {!f.preferencia_estilo && !f.cores_preferidas && !f.personagens_preferidos && (
                              <span className="text-slate-400 italic text-[10px]">Sem preferências cadastradas</span>
                            )}
                          </div>
                        </div>

                        {f.data_atualizacao_tamanho && (
                          <div className="text-[9px] text-slate-400 flex items-center gap-1.5 mt-1 justify-end">
                            <History className="h-3 w-3" />
                            Última at. tamanho: {new Date(f.data_atualizacao_tamanho).toLocaleDateString('pt-BR')}
                          </div>
                        )}

                        {f.observacoes && (
                          <div className="mt-2 p-2 rounded-lg bg-yellow-50/50 border border-yellow-100 text-slate-600 text-[11px]">
                            <span className="font-semibold text-yellow-800">Obs:</span> {f.observacoes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB HISTORICO */}
            <TabsContent value="historico" className="space-y-4 py-4">
              {historyLogs.length === 0 ? (
                <div className="text-center py-10 border rounded-xl bg-slate-50/50 text-slate-500 text-xs">
                  Nenhum histórico registrado para este cliente.
                </div>
              ) : (
                <div className="relative border-l pl-4 ml-2 space-y-6 max-h-[300px] overflow-y-auto">
                  {historyLogs.map((log, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute left-[-21px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">
                          {log.created_at ? new Date(log.created_at.seconds * 1000).toLocaleString("pt-BR") : "Agora mesmo"}
                        </span>
                        <span className="font-bold text-xs text-slate-800 mt-0.5">{log.tipo_acao}</span>
                        <span className="text-xs text-slate-600 mt-0.5">{log.descricao}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB CARTEIRA */}
            <TabsContent value="carteira" className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border shadow-none rounded-xl bg-indigo-50/20">
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Saldo Disponível</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-1">
                    <div className="text-2xl font-bold text-indigo-600">R$ {walletInfo?.saldo_atual?.toFixed(2) || "0.00"}</div>
                    <span className="text-[9px] text-indigo-500/80 font-medium block">
                      ✓ R$ {computedBalanceFromExtrato.toFixed(2)} calculado pelo extrato
                    </span>
                  </CardContent>
                </Card>

                <Card className="border shadow-none rounded-xl">
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Créditos Gerados</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="text-2xl font-bold text-emerald-600">R$ {walletInfo?.total_creditos_gerados?.toFixed(2) || "0.00"}</div>
                  </CardContent>
                </Card>

                <Card className="border shadow-none rounded-xl">
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Créditos Utilizados</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="text-2xl font-bold text-rose-600">R$ {walletInfo?.total_creditos_utilizados?.toFixed(2) || "0.00"}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Botão de ajuste manual */}
              <div className="flex justify-end mt-2">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs gap-1.5 h-8" onClick={() => setIsAdjustingWallet(!isAdjustingWallet)}>
                  <Wallet className="h-4 w-4" /> Ajuste Manual de Saldo
                </Button>
              </div>

              {isAdjustingWallet && (
                <div className="p-4 border border-amber-200 rounded-xl bg-amber-50/20 space-y-4">
                  <h4 className="font-bold text-xs text-amber-800">Ajuste Manual de Crédito Autorizado</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo do Ajuste</Label>
                      <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENTRADA">Adicionar Crédito (Entrada)</SelectItem>
                          <SelectItem value="SAIDA">Retirar Crédito (Saída)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input type="number" step="0.01" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0.00" className="h-9" />
                    </div>

                    <div className="space-y-1 col-span-1 sm:col-span-3">
                      <Label className="text-xs">Motivo / Observação Obrigatória *</Label>
                      <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Ajuste comercial, devolução de peças fora do prazo, etc..." className="h-9" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-amber-100">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setIsAdjustingWallet(false)}>Cancelar</Button>
                    <Button className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 px-4" onClick={handleSaveWalletAdjustment} disabled={isSavingWallet}>
                      {isSavingWallet ? "Gravando..." : "Salvar Ajuste"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Extrato Extendido da carteira */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-700">Histórico de Movimentações da Carteira</h4>
                {walletHistory.length === 0 ? (
                  <div className="text-center py-6 border rounded-xl bg-slate-50/50 text-slate-500 text-xs">
                    Nenhuma transação financeira efetuada.
                  </div>
                ) : (
                  <div className="max-h-[200px] overflow-y-auto border rounded-xl divide-y text-xs">
                    {walletHistory.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold uppercase ${item.tipo_movimentacao === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.tipo_movimentacao}
                            </span>
                            <Badge variant="outline" className="text-[9px] font-normal">{item.origem}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Responsável: {item.usuario_responsavel} · Obs: {item.observacao}</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold text-sm ${item.tipo_movimentacao === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.tipo_movimentacao === 'ENTRADA' ? '+' : '-'} R$ {item.valor?.toFixed(2)}
                          </span>
                          <p className="text-[9px] text-slate-400">{item.created_at ? new Date(item.created_at.seconds * 1000).toLocaleDateString("pt-BR") : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB TROCAS */}
            <TabsContent value="trocas" className="space-y-4 py-4">
              {returnsHistory.length === 0 ? (
                <div className="text-center py-10 border rounded-xl bg-slate-50/50 text-slate-500 text-xs">
                  Sem trocas ou devoluções registradas no histórico.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto border rounded-xl divide-y text-xs">
                  {returnsHistory.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold uppercase text-slate-700">{item.tipo}</span>
                        <p className="text-[10px] text-slate-500">Motivo: {item.motivo} · Destino: {item.destino_produto}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800">R$ {item.valor_total?.toFixed(2)}</span>
                        <p className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB TAGS */}
            <TabsContent value="tags" className="space-y-4 py-4">
              <div>
                <h4 className="font-bold text-xs text-slate-700 mb-2">Vincule Tags de Segmentação ao Perfil</h4>
                <p className="text-[11px] text-muted-foreground mb-4">Selecione as tags adequadas para categorizar este cliente nas listas de WhatsApp.</p>
                
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.nome)
                    return (
                      <Badge 
                        key={tag.id} 
                        style={{ backgroundColor: isSelected ? tag.cor : '#e2e8f0', color: isSelected ? '#fff' : '#475569' }}
                        className="cursor-pointer px-3 py-1 text-xs border-0 hover:opacity-85 select-none"
                        onClick={() => handleUpdateTags(tag.nome)}
                      >
                        {tag.nome} {isSelected ? "✓" : "+"}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            {/* TAB OBSERVACOES */}
            <TabsContent value="obs" className="space-y-4 py-4">
              <Card className="border shadow-none rounded-xl">
                <CardContent className="p-4 text-xs text-slate-700 whitespace-pre-wrap italic">
                  {selectedCustomer?.observacoes || "Sem observações internas cadastradas."}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Fechar Abas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD FILHO DIALOG */}
      <Dialog open={isQuickAddFilhoOpen} onOpenChange={setIsQuickAddFilhoOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Baby className="h-5 w-5 text-indigo-600" /> Cadastrar Filho(a)
            </DialogTitle>
            <DialogDescription>
              Adicione uma criança à ficha de {selectedCustomer?.nome}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1">
              <Label>Nome da Criança *</Label>
              <Input 
                value={quickFilhoForm.nome} 
                onChange={e => setQuickFilhoForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Amanda dos Santos"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nascimento</Label>
                <Input 
                  type="date" 
                  value={quickFilhoForm.data_nascimento} 
                  onChange={e => setQuickFilhoForm(p => ({ ...p, data_nascimento: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Sexo</Label>
                <Select value={quickFilhoForm.sexo} onValueChange={v => setQuickFilhoForm(p => ({ ...p, sexo: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Menino</SelectItem>
                    <SelectItem value="F">Menina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tamanho de Roupa</Label>
                <Select value={quickFilhoForm.tamanho_roupa} onValueChange={v => setQuickFilhoForm(p => ({ ...p, tamanho_roupa: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Roupa" />
                  </SelectTrigger>
                  <SelectContent>
                    {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Tamanho de Calçado</Label>
                <Input 
                  value={quickFilhoForm.tamanho_calcado} 
                  onChange={e => setQuickFilhoForm(p => ({ ...p, tamanho_calcado: e.target.value }))}
                  placeholder="Ex: 22"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Preferência de Estilo</Label>
              <Input 
                value={quickFilhoForm.preferencia_estilo} 
                onChange={e => setQuickFilhoForm(p => ({ ...p, preferencia_estilo: e.target.value }))}
                placeholder="Ex: Casual, blogueirinho, colorido..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cores Preferidas</Label>
                <Input 
                  value={quickFilhoForm.cores_preferidas} 
                  onChange={e => setQuickFilhoForm(p => ({ ...p, cores_preferidas: e.target.value }))}
                  placeholder="Azul, verde..."
                />
              </div>

              <div className="space-y-1">
                <Label>Personagens Favoritos</Label>
                <Input 
                  value={quickFilhoForm.personagens_preferidos} 
                  onChange={e => setQuickFilhoForm(p => ({ ...p, personagens_preferidos: e.target.value }))}
                  placeholder="Batman, Mickey..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações Gerais</Label>
              <Textarea 
                value={quickFilhoForm.observacoes} 
                onChange={e => setQuickFilhoForm(p => ({ ...p, observacoes: e.target.value }))}
                placeholder="Alergias, preferências de tecidos ou observações..."
                className="h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsQuickAddFilhoOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              size="sm"
              onClick={handleSaveQuickFilho}
              disabled={isSavingQuickFilho}
            >
              {isSavingQuickFilho ? "Salvando..." : "Salvar Filho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK SIZE UPDATE DIALOG */}
      <Dialog open={isQuickSizeUpdateOpen} onOpenChange={setIsQuickSizeUpdateOpen}>
        <DialogContent className="max-w-sm bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" /> Atualizar Tamanho Rápido
            </DialogTitle>
            <DialogDescription>
              Atualize as medidas de {selectedFilhoForUpdate?.nome}. O histórico de alterações será registrado na ficha do cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Novo Tamanho Roupa</Label>
                <Select value={newTamanhoRoupa} onValueChange={setNewTamanhoRoupa}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Roupa" />
                  </SelectTrigger>
                  <SelectContent>
                    {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Anterior: {selectedFilhoForUpdate?.tamanho_roupa || "Não inf."}</span>
              </div>

              <div className="space-y-1">
                <Label>Novo Tamanho Calçado</Label>
                <Input 
                  value={newTamanhoCalcado} 
                  onChange={e => setNewTamanhoCalcado(e.target.value)}
                  placeholder="Ex: 24"
                />
                <span className="text-[10px] text-muted-foreground block mt-0.5">Anterior: {selectedFilhoForUpdate?.tamanho_calcado || "Não inf."}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Motivo / Observação da Atualização *</Label>
              <Textarea 
                value={sizeUpdateReason} 
                onChange={e => setSizeUpdateReason(e.target.value)}
                placeholder="Ex: Cresceu rápido, presente do avô..."
                className="h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsQuickSizeUpdateOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              size="sm"
              onClick={handleSaveSizeUpdate}
              disabled={isSavingSizeUpdate}
            >
              {isSavingSizeUpdate ? "Salvando..." : "Salvar Tamanho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
