"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
  MoreVertical, 
  Phone, 
  Mail, 
  Tag as TagIcon, 
  Loader2, 
  Baby, 
  History, 
  Wallet, 
  Pencil, 
  Trash2, 
  Plus, 
  AlertCircle,
  Eye,
  CheckCircle,
  Info,
  User,
  PlusCircle
} from "lucide-react"

// Firebase imports for reading hybrid collections (e.g., trocas_devolucoes)
import { useFirestore } from "@/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

import { toast } from "@/hooks/use-toast"
import { useProfile } from "@/lib/contexts/profile-context"
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createChild,
  updateChild,
  deleteChild,
  getTags,
  addTagToCustomer,
  removeTagFromCustomer,
  adjustWalletBalance,
  getCustomerHistory,
  getWalletHistory
} from "@/lib/crm/actions"

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
  if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""} e ${meses} m├¬s${meses !== 1 ? "es" : ""}`
  return `${meses} m├¬s${meses !== 1 ? "es" : ""}`
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
  origem: "Loja F├¡sica",
  vip: false,
  aceita_marketing: true,
  observacoes: "",
  status: "ativo" as "ativo" | "inativo" | "arquivado"
}

export default function ClientesPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()
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
      const isPositive = move.tipo_movimentacao === "ENTRADA"
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

  // Quick Child Addition inside details abas
  const [isQuickAddFilhoOpen, setIsQuickAddFilhoOpen] = useState(false)
  const [quickFilhoForm, setQuickFilhoForm] = useState(emptyFilhoForm)
  const [isSavingQuickFilho, setIsSavingQuickFilho] = useState(false)

  // Quick Customer child addition fields
  const [rapidoFilhoNome, setRapidoFilhoNome] = useState("")
  const [rapidoFilhoIdade, setRapidoFilhoIdade] = useState("")

  // Mapping client IDs to their wallet balances
  const [walletsMap, setWalletsMap] = useState<Record<string, number>>({})

  // Supabase states
  const [rawCustomers, setRawCustomers] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [custRes, tagsRes] = await Promise.all([
        getCustomers(),
        getTags()
      ])

      if (custRes.success && custRes.data) {
        // Map postgres model to compatible frontend structure
        const mapped = custRes.data.map((c: any) => ({
          id: c.id,
          nome: c.name,
          email: c.email,
          whatsapp_principal: c.phone,
          whatsapp: c.phone,
          cpf: c.cpf,
          data_nascimento: c.birthMonth && c.birthDay ? `${c.birthYear || 2000}-${String(c.birthMonth).padStart(2, '0')}-${String(c.birthDay).padStart(2, '0')}` : "",
          instagram: c.instagram,
          observacoes: c.notes,
          status: c.status,
          vip: c.status === 'vip',
          tags: c.tagRelations.map((r: any) => r.tag.name),
          children: c.children,
          wallet: c.wallet
        }))
        setRawCustomers(mapped)

        // Build wallet balance mapping
        const wMap: Record<string, number> = {}
        custRes.data.forEach((c: any) => {
          if (c.wallet) {
            wMap[c.id] = Number(c.wallet.balance)
          }
        })
        setWalletsMap(wMap)
      } else {
        setError(custRes.error || "Erro ao carregar clientes.")
      }

      if (tagsRes.success && tagsRes.data) {
        setAvailableTags(tagsRes.data)
      }
    } catch (e: any) {
      console.error(e)
      setError("Falha ao carregar dados do Supabase.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredCustomers = useMemo(() => {
    if (!rawCustomers) return []
    return rawCustomers.filter(c => {
      const matchSearch = 
        c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.whatsapp_principal?.includes(searchTerm) ||
        c.cpf?.replace(/\D/g, "").includes(searchTerm.replace(/\D/g, ""))
      
      const matchStatus = statusFilter === "todos" || c.status === statusFilter
      if (!matchSearch || !matchStatus) return false

      const tabParam = searchParams?.get("tab")
      if (tabParam === "aniversariantes") {
        const dateField = c.data_nascimento
        if (!dateField) return false
        const bdayMonth = new Date(dateField).getMonth() + 1
        const currentMonth = new Date().getMonth() + 1
        return bdayMonth === currentMonth
      }

      return true
    })
  }, [rawCustomers, searchTerm, statusFilter, searchParams])

  const handleSaveQuickFilho = async () => {
    if (!quickFilhoForm.nome.trim()) {
      return toast({ variant: "destructive", title: "Nome obrigat├│rio", description: "Informe o nome da crian├ºa." })
    }
    if (!selectedCustomer) return

    setIsSavingQuickFilho(true)
    try {
      const payload = {
        customerId: selectedCustomer.id,
        name: quickFilhoForm.nome,
        birthDate: quickFilhoForm.data_nascimento || null,
        gender: quickFilhoForm.sexo || null,
        shoeSize: quickFilhoForm.tamanho_calcado || null,
        clothingSize: quickFilhoForm.tamanho_roupa || null,
        notes: quickFilhoForm.observacoes || null,
      }

      const res = await createChild(payload)

      if (res.success) {
        toast({ title: "Filho cadastrado!", description: "Dados gravados no Supabase." })
        await loadData()
        // Reload details aba
        if (selectedCustomer) {
          const freshData = rawCustomers?.find(c => c.id === selectedCustomer.id)
          if (freshData) {
            handleOpenDetails(freshData)
          }
        }
        setIsQuickAddFilhoOpen(false)
        setQuickFilhoForm(emptyFilhoForm)
      } else {
        toast({ variant: "destructive", title: "Erro ao cadastrar filho", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cadastrar filho" })
    } finally {
      setIsSavingQuickFilho(false)
    }
  }

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
      endereco: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
      origem: "Loja F├¡sica",
      vip: customer.status === 'vip',
      aceita_marketing: true,
      observacoes: customer.observacoes || "",
      status: customer.status || "ativo"
    })
    
    // Load existing linked children
    if (customer.children) {
      setFilhos(customer.children.map((f: any) => ({
        id: f.id,
        nome: f.name,
        data_nascimento: f.birthDate ? new Date(f.birthDate).toISOString().substring(0, 10) : "",
        sexo: f.gender || "",
        tamanho_roupa: f.clothingSize || "2",
        tamanho_calcado: f.shoeSize || "",
        observacoes: f.notes || "",
        status: "ativo"
      })))
    } else {
      setFilhos([])
    }
    setDeletedFilhos([])
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
    
    // Load tabs data from Supabase / Hybrid Firebase
    try {
      // 1. Kids
      if (customer.children) {
        setFilhos(customer.children.map((f: any) => ({
          id: f.id,
          nome: f.name,
          data_nascimento: f.birthDate ? new Date(f.birthDate).toISOString().substring(0, 10) : "",
          sexo: f.gender || "",
          tamanho_roupa: f.clothingSize || "2",
          tamanho_calcado: f.shoeSize || "",
          observacoes: f.notes || ""
        })))
      }

      // 2. Client history logs
      const historyRes = await getCustomerHistory(customer.id)
      if (historyRes.success && historyRes.data) {
        setHistoryLogs(historyRes.data.map((h: any) => ({
          id: h.id,
          tipo_acao: h.actionType,
          descricao: h.description,
          created_at: { seconds: new Date(h.createdAt).getTime() / 1000 }
        })))
      }

      // 3. Wallet details
      if (customer.wallet) {
        const wInfo = {
          id: customer.wallet.id,
          saldo_atual: Number(customer.wallet.balance)
        }
        setWalletInfo(wInfo)

        // 4. Wallet movements
        const walletMoves = await getWalletHistory(customer.wallet.id)
        if (walletMoves.success && walletMoves.data) {
          setWalletHistory(walletMoves.data.map((m: any) => ({
            id: m.id,
            tipo_movimentacao: m.type === 'credit' ? 'ENTRADA' : 'SAIDA',
            origem: m.reason?.includes('AJUSTE') ? 'AJUSTE_MANUAL' : 'SISTEMA',
            valor: Number(m.amount),
            observacao: m.reason || "",
            usuario_responsavel: "Operador",
            created_at: { seconds: new Date(m.createdAt).getTime() / 1000 }
          })))
        }
      } else {
        setWalletInfo(null)
        setWalletHistory([])
      }

      // 5. Returns (Hybrid query on Firebase Firestore since sale transactions remain there)
      if (db) {
        const returnsSnap = await getDocs(query(collection(db, "trocas_devolucoes"), where("cliente_id", "==", customer.id)))
        setReturnsHistory(returnsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      }

      // 6. Selected Tags
      setSelectedTags(customer.tags || [])
      
    } catch (e) {
      console.error("Erro ao carregar detalhes do cliente:", e)
    }
  }

  // Kids sub-form operations
  const handleAddFilho = () => {
    setFilhos([...filhos, { nome: "", data_nascimento: "", sexo: "", tamanho_roupa: "2", tamanho_calcado: "", observacoes: "", status: "ativo" }])
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

  // Save Cliente form (and linked Filhos)
  const handleSave = async () => {
    if (!form.nome.trim()) {
      return toast({ variant: "destructive", title: "Nome obrigat├│rio", description: "Preencha o nome completo." })
    }
    if (!form.whatsapp_principal.trim()) {
      return toast({ variant: "destructive", title: "WhatsApp obrigat├│rio", description: "WhatsApp principal ├® de preenchimento obrigat├│rio." })
    }

    const cleanWhatsapp = form.whatsapp_principal.replace(/\D/g, "")
    setIsSaving(true)

    try {
      let bDay: number | null = null
      let bMonth: number | null = null
      let bYear: number | null = null

      if (form.data_nascimento) {
        const parts = form.data_nascimento.split("-")
        if (parts.length === 3) {
          bYear = parseInt(parts[0])
          bMonth = parseInt(parts[1])
          bDay = parseInt(parts[2])
        }
      }

      const clientPayload = {
        name: form.nome,
        email: form.email || null,
        phone: cleanWhatsapp,
        cpf: form.cpf || null,
        birthDay: bDay,
        birthMonth: bMonth,
        birthYear: bYear,
        instagram: form.instagram || null,
        notes: form.observacoes || null,
        status: form.status,
      }

      let savedClient: any = null
      if (editingCustomer) {
        const res = await updateCustomer(editingCustomer.id, clientPayload)
        if (res.success) {
          savedClient = res.data
          toast({ title: "Cliente atualizado!", description: "Dados gravados no Supabase." })
        } else {
          setIsSaving(false)
          return toast({ variant: "destructive", title: "Erro ao atualizar", description: res.error })
        }
      } else {
        const res = await createCustomer(clientPayload)
        if (res.success) {
          savedClient = res.data
          toast({ title: "Cliente criado!", description: "Cadastro realizado com carteira inicial preparada." })
        } else {
          setIsSaving(false)
          return toast({ variant: "destructive", title: "Erro ao criar cliente", description: res.error })
        }
      }

      const clientId = savedClient.id
      let batchFilhos = [...filhos]

      if (isCadastroRapido && rapidoFilhoNome.trim()) {
        let dataNascCalculada = ""
        if (rapidoFilhoIdade) {
          const anos = Number(rapidoFilhoIdade)
          if (!isNaN(anos) && anos >= 0) {
            const anoNasc = new Date().getFullYear() - anos
            dataNascCalculada = `${anoNasc}-06-15`
          }
        }

        batchFilhos = [{
          nome: rapidoFilhoNome.trim(),
          data_nascimento: dataNascCalculada,
          sexo: "M",
          tamanho_roupa: "2",
          tamanho_calcado: "",
          observacoes: "",
          status: "ativo"
        }]
      }

      for (const filho of batchFilhos) {
        if (!filho.nome.trim()) continue
        const childPayload = {
          customerId: clientId,
          name: filho.nome,
          birthDate: filho.data_nascimento || null,
          gender: filho.sexo || null,
          shoeSize: filho.tamanho_calcado || null,
          clothingSize: filho.tamanho_roupa || null,
          notes: filho.observacoes || null
        }

        if (filho.id) {
          await updateChild(filho.id, childPayload)
        } else {
          await createChild(childPayload)
        }
      }

      // Process deleted kids
      for (const delId of deletedFilhos) {
        await deleteChild(delId)
      }

      await loadData()
      setIsFormOpen(false)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Ocorreu um erro ao gravar as altera├º├Áes." })
    } finally {
      setIsSaving(false)
    }
  }

  // Soft delete executing
  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await deleteCustomer(deletingId)
      if (res.success) {
        toast({ title: "Cliente arquivado", description: "O cliente foi movido para o arquivo no Supabase." })
        await loadData()
      } else {
        toast({ variant: "destructive", title: "Erro ao excluir", description: res.error })
      }
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
      return toast({ variant: "destructive", title: "Valor inv├ílido" })
    }
    if (!adjustReason.trim()) {
      return toast({ variant: "destructive", title: "Observa├º├úo obrigat├│ria", description: "Voc├¬ deve informar o motivo do ajuste manual." })
    }
    if (!walletInfo) return

    setIsSavingWallet(true)
    try {
      const res = await adjustWalletBalance({
        customerId: selectedCustomer.id,
        amount: Number(adjustAmount),
        type: adjustType === "ENTRADA" ? "credit" : "debit",
        reason: adjustReason
      })

      if (res.success) {
        toast({ title: "Saldo ajustado!", description: `Carteira atualizada no Supabase.` })
        await loadData()
        // Reload details tab to show changes
        const freshData = rawCustomers?.find(c => c.id === selectedCustomer.id)
        if (freshData) {
          handleOpenDetails(freshData)
        }
        setIsAdjustingWallet(false)
        setAdjustAmount("")
        setAdjustReason("")
      } else {
        toast({ variant: "destructive", title: "Erro ao processar ajuste", description: res.error })
      }
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
    const tagObj = availableTags.find(t => t.name === tagNome)
    if (!tagObj) return

    try {
      if (selectedTags.includes(tagNome)) {
        const relToDelete = selectedCustomer.tagRelations?.find((r: any) => r.tag?.name === tagNome)
        if (relToDelete) {
          await removeTagFromCustomer(selectedCustomer.id, relToDelete.tagId)
        }
      } else {
        await addTagToCustomer(selectedCustomer.id, tagObj.id)
      }
      
      await loadData()
      
      const freshData = rawCustomers?.find(c => c.id === selectedCustomer.id)
      if (freshData) {
        setSelectedTags(freshData.tags || [])
      }
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
            <User className="h-8 w-8 text-indigo-600" /> Clientes & Respons├íveis
          </h1>
          <p className="text-muted-foreground text-sm">Controle completo de compradores, v├¡nculo de filhos, tags e extrato de saldo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="border-indigo-100 text-indigo-600 hover:bg-indigo-50/50 gap-2 h-10 font-semibold" onClick={() => handleOpenCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Cadastro R├ípido
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

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
          <div>
            <h3 className="font-semibold text-base">Erro na base</h3>
            <p className="text-sm">{error}</p>
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
          <p className="text-muted-foreground text-sm mt-1">Refine a busca ou adicione um novo registro de respons├ível.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="overflow-hidden border border-slate-100 shadow-sm hover:border-indigo-500/30 group hover:shadow-md transition-all duration-300 bg-white">
              <div className="p-4 pb-2 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{customer.nome}</h3>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 shrink-0" />
                    {formatPhone(customer.whatsapp_principal)}
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenDetails(customer)}>
                      <Eye className="mr-2 h-4 w-4 text-indigo-500" /> Ficha Completa
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenEdit(customer)}>
                      <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar Ficha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-rose-600 cursor-pointer" onClick={() => handleOpenDelete(customer.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Arquivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <CardContent className="p-4 pt-1 space-y-3 text-xs">
                {/* Balance display */}
                <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between border">
                  <span className="text-slate-400 font-semibold uppercase text-[9px] flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-indigo-500" /> Cr├®dito
                  </span>
                  <strong className="text-indigo-600 text-sm">
                    R$ {(walletsMap[customer.id] || 0).toFixed(2)}
                  </strong>
                </div>

                {/* Children names list */}
                {customer.children && customer.children.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-semibold block uppercase">Filhos</span>
                    <div className="flex flex-wrap gap-1">
                      {customer.children.map((kid: any) => (
                        <Badge key={kid.id} variant="secondary" className="text-[9px] font-normal py-0 px-2 flex items-center gap-0.5 bg-slate-100 text-slate-700">
                          <Baby className="h-2.5 w-2.5" />
                          {kid.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic block">Sem filhos vinculados</span>
                )}

                {/* Display active tags */}
                {customer.tags && customer.tags.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-50">
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.map((t: string) => (
                        <Badge key={t} className="text-[8px] bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 font-bold px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DIALOG ADD/EDIT CUSTOMER */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {editingCustomer ? "Editar Ficha de Cliente" : "Cadastrar Novo Cliente Respons├ível"}
            </DialogTitle>
            <DialogDescription>
              {isCadastroRapido ? "Preencha os campos essenciais para liberar a venda rapidamente." : "Registre os dados completos do comprador e vincule dependentes para segmenta├º├úo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="cnome">Nome Completo *</Label>
                <Input id="cnome" placeholder="Ex: Felipe Naiff" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ccpf">CPF</Label>
                <Input id="ccpf" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="cwhats">WhatsApp Principal *</Label>
                <Input id="cwhats" placeholder="Ex: (11) 99999-9999" value={form.whatsapp_principal} onChange={e => setForm({ ...form, whatsapp_principal: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cwhats2">WhatsApp Secund├írio</Label>
                <Input id="cwhats2" placeholder="Ex: (11) 99999-9999" value={form.whatsapp_secundario} onChange={e => setForm({ ...form, whatsapp_secundario: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="cemail">E-mail</Label>
                <Input id="cemail" type="email" placeholder="cliente@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cnasc">Data de Nascimento</Label>
                <Input id="cnasc" type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
              </div>
            </div>

            {!isCadastroRapido ? (
              <>
                <Separator />
                <h3 className="font-bold text-slate-800 text-sm">Vincular Filhos / Dependentes</h3>
                
                {filhos.length === 0 ? (
                  <p className="text-muted-foreground italic">Nenhum filho cadastrado para este respons├ível.</p>
                ) : (
                  <div className="space-y-3">
                    {filhos.map((filho, idx) => (
                      <div key={idx} className="border p-3 rounded-lg bg-slate-50/50 space-y-3 relative">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 absolute top-2 right-2" onClick={() => handleRemoveFilho(idx)}>
                          Ô£ò
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Nome do Filho *</Label>
                            <Input placeholder="Ex: Arthur Naiff" value={filho.nome} onChange={e => handleFilhoChange(idx, "nome", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Nascimento</Label>
                            <Input type="date" value={filho.data_nascimento} onChange={e => handleFilhoChange(idx, "data_nascimento", e.target.value)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label>Sexo</Label>
                            <select className="w-full border rounded h-9 px-2 bg-white" value={filho.sexo} onChange={e => handleFilhoChange(idx, "sexo", e.target.value)}>
                              <option value="">Selecionar</option>
                              <option value="M">Menino</option>
                              <option value="F">Menina</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label>Tam. Roupa</Label>
                            <select className="w-full border rounded h-9 px-2 bg-white" value={filho.tamanho_roupa} onChange={e => handleFilhoChange(idx, "tamanho_roupa", e.target.value)}>
                              {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label>Cal├ºado</Label>
                            <Input placeholder="Ex: 24" value={filho.tamanho_calcado} onChange={e => handleFilhoChange(idx, "tamanho_calcado", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button variant="outline" className="h-9 gap-1 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50" onClick={handleAddFilho}>
                  <Plus className="h-4 w-4" /> Adicionar Dependente
                </Button>
              </>
            ) : (
              <div className="bg-indigo-50/30 p-3 rounded-lg border space-y-3">
                <h4 className="font-bold text-indigo-950 uppercase text-[10px] tracking-wider block">Cadastro R├ípido do Primeiro Filho</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nome do Filho</Label>
                    <Input placeholder="Ex: Lucas" value={rapidoFilhoNome} onChange={e => setRapidoFilhoNome(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Idade Aproximada (Anos)</Label>
                    <Input type="number" placeholder="Ex: 4" value={rapidoFilhoIdade} onChange={e => setRapidoFilhoIdade(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <Separator />
            
            <div className="space-y-2">
              <Label>Observa├º├Áes de Atendimento</Label>
              <Textarea placeholder="Hist├│rico de alergias, marcas preferidas, restri├º├Áes..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <div className="flex items-center gap-6 bg-slate-50 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Switch id="cvip" checked={form.vip === true} onCheckedChange={checked => setForm({ ...form, vip: checked, status: checked ? 'ativo' : 'ativo' })} />
                <Label htmlFor="cvip" className="font-semibold cursor-pointer">Marcar como Cliente VIP</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="cmarketing" checked={form.aceita_marketing} onCheckedChange={checked => setForm({ ...form, aceita_marketing: checked })} />
                <Label htmlFor="cmarketing" className="font-semibold cursor-pointer">Aceita WhatsApp Marketing</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCustomer ? "Salvar Altera├º├Áes" : "Concluir Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE CUSTOMER */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-slate-800">Inativar Ficha do Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja arquivar este cliente? O saldo atual da carteira permanecer├í congelado, mas o cadastro n├úo constar├í nas listagens de vendas ativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500" onClick={handleDelete}>
              Confirmar Arquivamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DETAILS VIEW DIALOG */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader className="border-b pb-4">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">{selectedCustomer?.nome}</DialogTitle>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-slate-500 text-xs">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {formatPhone(selectedCustomer?.whatsapp_principal)}</span>
                  {selectedCustomer?.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selectedCustomer?.email}</span>}
                </div>
              </div>
              <Badge className={selectedCustomer?.status === 'vip' ? "bg-amber-100 text-amber-800 border-amber-200 font-bold" : "bg-indigo-50 text-indigo-700 border-indigo-200"}>
                {selectedCustomer?.status?.toUpperCase()}
              </Badge>
            </div>
          </DialogHeader>

          <Tabs defaultValue="ficha" className="w-full mt-4">
            <TabsList className="bg-white border w-full justify-start gap-1 p-1">
              <TabsTrigger value="ficha" className="flex items-center gap-1.5">Ficha B├ísica</TabsTrigger>
              <TabsTrigger value="filhos" className="flex items-center gap-1.5"><Baby className="h-4 w-4 text-emerald-600" /> Dependentes ({filhos.length})</TabsTrigger>
              <TabsTrigger value="carteira" className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-indigo-600" /> Cr├®ditos/Carteira</TabsTrigger>
              <TabsTrigger value="trocas" className="flex items-center gap-1.5">Trocas ({returnsHistory.length})</TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-1.5"><History className="h-4 w-4" /> Hist├│rico CRM ({historyLogs.length})</TabsTrigger>
            </TabsList>

            {/* TAB: Ficha B├ísica */}
            <TabsContent value="ficha" className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">CPF</span>
                    <span className="text-slate-800 font-medium block mt-1">{selectedCustomer?.cpf || "N├úo informado"}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Data de Nascimento</span>
                    <span className="text-slate-800 font-medium block mt-1">
                      {selectedCustomer?.data_nascimento ? new Date(selectedCustomer.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "N├úo informada"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedCustomer?.observacoes && (
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <span className="text-slate-400 font-semibold block uppercase text-[10px]">Notas de Atendimento</span>
                      <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed">{selectedCustomer?.observacoes}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Etiquetas de Segmenta├º├úo</span>
                    
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {availableTags.map((tag) => {
                        const active = selectedTags.includes(tag.name)
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleUpdateTags(tag.name)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                              active
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {tag.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Dependentes */}
            <TabsContent value="filhos" className="space-y-4 pt-4 text-xs">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Crian├ºas Associadas</h3>
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 h-8 text-[11px]" onClick={() => setIsQuickAddFilhoOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar Crian├ºa
                </Button>
              </div>

              {filhos.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
                  Sem crian├ºas vinculadas a este respons├ível.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filhos.map((filho, idx) => (
                    <Card key={idx} className="border border-slate-100 shadow-sm bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${filho.sexo === "F" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}`}>
                            {filho.nome?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{filho.nome}</p>
                            {filho.data_nascimento && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(filho.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")} ┬À {calcIdade(filho.data_nascimento)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mt-3">
                        <Badge variant="outline" className={`text-[8px] h-4 ${filho.sexo === "M" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-pink-50 text-pink-700 border-pink-200"}`}>
                          {filho.sexo === "M" ? "Menino" : "Menina"}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] h-4 bg-slate-50 text-slate-600">
                          Roupas: {filho.tamanho_roupa || "2"}
                        </Badge>
                        {filho.tamanho_calcado && (
                          <Badge variant="outline" className="text-[8px] h-4 bg-indigo-50 text-indigo-700 border-indigo-100">
                            Cal├ºado: {filho.tamanho_calcado}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB: Carteira de Cr├®ditos */}
            <TabsContent value="carteira" className="space-y-4 pt-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/50 p-4 border rounded-xl">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Saldo Dispon├¡vel</span>
                  <strong className="text-2xl text-indigo-600 block mt-1">R$ {walletInfo?.saldo_atual?.toFixed(2) || "0.00"}</strong>
                </div>

                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 self-start sm:self-auto" onClick={() => setIsAdjustingWallet(true)}>
                  <PlusCircle className="h-4 w-4" /> Ajuste Manual de Saldo
                </Button>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-sm">Hist├│rico do Extrato</h4>
                {walletHistory.length === 0 ? (
                  <p className="text-muted-foreground italic text-center py-6">Nenhuma movimenta├º├úo registrada.</p>
                ) : (
                  <div className="border rounded-xl divide-y bg-white">
                    {walletHistory.map((move, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold uppercase ${move.tipo_movimentacao === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {move.tipo_movimentacao}
                            </span>
                            <Badge variant="outline" className="text-[8px] font-normal h-4">{move.origem}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Motivo: {move.observacao}</p>
                        </div>
                        <div className="text-right">
                          <strong className={move.tipo_movimentacao === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}>
                            {move.tipo_movimentacao === 'ENTRADA' ? '+' : '-'} R$ {move.valor?.toFixed(2)}
                          </strong>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {move.created_at ? new Date(move.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB: Trocas e Devolu├º├Áes */}
            <TabsContent value="trocas" className="space-y-4 pt-4 text-xs">
              <h3 className="font-bold text-slate-800 text-sm">Hist├│rico de Trocas (PDV)</h3>
              {returnsHistory.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
                  Nenhuma troca registrada para este comprador.
                </div>
              ) : (
                <div className="border rounded-xl divide-y bg-white">
                  {returnsHistory.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div>
                        <strong className="text-slate-800">Troca #{item.venda_id?.substring(0,8) || item.id?.substring(0,8)}</strong>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Respons├ível: {item.vendedor_nome || "Balc├úo"}</p>
                      </div>
                      <div className="text-right">
                        <strong className="text-indigo-600">R$ {Number(item.valor_credito || item.valor || 0).toFixed(2)}</strong>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {item.created_at ? new Date(item.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB: Hist├│rico CRM */}
            <TabsContent value="historico" className="space-y-4 pt-4 text-xs">
              <h3 className="font-bold text-slate-800 text-sm">Hist├│rico de Auditoria do Cliente</h3>
              {historyLogs.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
                  Sem registros de hist├│rico.
                </div>
              ) : (
                <div className="border rounded-xl divide-y bg-white">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="p-3 flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{log.tipo_acao}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{log.descricao}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0 self-start">
                        {log.created_at ? new Date(log.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4 mt-6">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Fechar Ficha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD CHILD IN DETAILS */}
      <Dialog open={isQuickAddFilhoOpen} onOpenChange={setIsQuickAddFilhoOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Vincular Novo Filho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Nome Completo</Label>
              <Input placeholder="Ex: Arthur" value={quickFilhoForm.nome} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nascimento</Label>
                <Input type="date" value={quickFilhoForm.data_nascimento} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, data_nascimento: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Sexo</Label>
                <select className="w-full border rounded h-9 px-2 bg-white" value={quickFilhoForm.sexo} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, sexo: e.target.value })}>
                  <option value="">Selecionar</option>
                  <option value="M">Menino</option>
                  <option value="F">Menina</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tamanho Roupa</Label>
                <select className="w-full border rounded h-9 px-2 bg-white" value={quickFilhoForm.tamanho_roupa} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, tamanho_roupa: e.target.value })}>
                  {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cal├ºado</Label>
                <Input placeholder="Ex: 24" value={quickFilhoForm.tamanho_calcado} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, tamanho_calcado: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsQuickAddFilhoOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSaveQuickFilho} disabled={isSavingQuickFilho}>
              {isSavingQuickFilho && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADJUST WALLET DIALOG IN DETAILS */}
      <Dialog open={isAdjustingWallet} onOpenChange={setIsAdjustingWallet}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Ajuste de Saldo da Carteira</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>A├º├úo</Label>
              <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Adicionar Cr├®dito (Entrada)</SelectItem>
                  <SelectItem value="SAIDA">Debitar Cr├®dito (Sa├¡da)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Justificativa Obrigat├│ria</Label>
              <Input placeholder="Ex: Ajuste manual" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsAdjustingWallet(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSaveWalletAdjustment} disabled={isSavingWallet}>
              {isSavingWallet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
