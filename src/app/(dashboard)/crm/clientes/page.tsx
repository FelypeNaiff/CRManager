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

import { toast } from "@/hooks/use-toast"
import { AuthorizationDialog } from "@/components/authorization/authorization-dialog"
import { safeInteger, safeNumber } from "@/lib/utils/form-normalizer"
import { useProfile } from "@/lib/contexts/profile-context"
import { usePermissions } from "@/hooks/use-permissions"
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
  getWalletHistory,
  getCustomerExchangeReturns
} from "@/lib/crm/actions"
import { getCustomerWalletAction, createManualAdjustmentAction } from "@/lib/wallet/wallet-actions"

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
  const { activeProfile } = useProfile()
  const { can } = usePermissions()
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

  // Wallet filter states
  const [walletFilterStartDate, setWalletFilterStartDate] = useState("")
  const [walletFilterEndDate, setWalletFilterEndDate] = useState("")
  const [walletFilterType, setWalletFilterType] = useState("ALL")
  const [walletFilterOrigin, setWalletFilterOrigin] = useState("ALL")

  const loadWalletData = useCallback(async (customerId: string) => {
    if (!customerId) return
    const filters: any = {}
    if (walletFilterStartDate) filters.startDate = new Date(walletFilterStartDate + "T00:00:00")
    if (walletFilterEndDate) filters.endDate = new Date(walletFilterEndDate + "T23:59:59")
    if (walletFilterType !== "ALL") filters.type = walletFilterType
    if (walletFilterOrigin !== "ALL") filters.origin = walletFilterOrigin

    const res = await getCustomerWalletAction(customerId, filters)
    if (res.success && res.wallet) {
      setWalletInfo({
        id: res.wallet.id,
        saldo_atual: res.wallet.balance,
        total_creditos: res.totalCredits || 0,
        total_debitos: res.totalDebits || 0
      })
      setWalletHistory(res.transactions || [])
    } else {
      setWalletInfo(null)
      setWalletHistory([])
    }
  }, [walletFilterStartDate, walletFilterEndDate, walletFilterType, walletFilterOrigin])

  // Trigger reload when filters change
  useEffect(() => {
    if (selectedCustomer?.id && isDetailsOpen) {
      loadWalletData(selectedCustomer.id)
    }
  }, [selectedCustomer?.id, isDetailsOpen, loadWalletData])

  const [returnsHistory, setReturnsHistory] = useState<any[]>([])
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Manual adjustment wallet state
  const [isAdjustingWallet, setIsAdjustingWallet] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustType, setAdjustType] = useState<"ENTRADA" | "SAIDA">("ENTRADA")
  const [adjustReason, setAdjustReason] = useState("")
  const [isSavingWallet, setIsSavingWallet] = useState(false)
  const [authorizationId, setAuthorizationId] = useState("")
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  // Quick Child Addition inside details abas
  const [isQuickAddFilhoOpen, setIsQuickAddFilhoOpen] = useState(false)
  const [quickFilhoForm, setQuickFilhoForm] = useState(emptyFilhoForm)
  const [isSavingQuickFilho, setIsSavingQuickFilho] = useState(false)

  // Quick Customer child addition fields
  const [rapidoFilhoNãome, setRapidoFilhoNãome] = useState("")
  const [rapidoFilhoIdade, setRapidoFilhoIdade] = useState("")

  // Mapping client IDs to their wallet balances
  const [walletsMap, setWalletsMap] = useState<Record<string, number>>({})

  // Supabase states
  const [rawCustomers, setRawCustomers] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination states
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const tabParam = searchParams?.get("tab") || undefined

  const loadData = useCallback(async (currentPage: number = page) => {
    setIsLoading(true)
    setError(null)
    try {
      const [custRes, tagsRes] = await Promise.all([
        getCustomers({
          page: currentPage,
          pageSize: 50,
          search: searchTerm,
          status: statusFilter,
          tab: tabParam
        }),
        getTags()
      ])

      if (custRes.success && custRes.data && custRes.metadata) {
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
        setTotalPages(custRes.metadata.totalPages)
        setTotalCount(custRes.metadata.totalCount)

        // Build wallet balance mapping
        const wMap: Record<string, number> = {}
        custRes.data.forEach((c: any) => {
          if (c.wallet) {
            wMap[c.id] = safeNumber(c.wallet.balance) ?? 0
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
      setError("Não foi possível carregar os clientes. Tente atualizar a página. Se o erro continuar, verifique a conexão com o banco.")
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, statusFilter, tabParam])

  const lastLoadedRef = React.useRef({ page: 0, searchTerm: "", statusFilter: "", tab: "" })

  useEffect(() => {
    const currentTab = tabParam || ""
    const filtersChanged = 
      searchTerm !== lastLoadedRef.current.searchTerm ||
      statusFilter !== lastLoadedRef.current.statusFilter ||
      currentTab !== lastLoadedRef.current.tab

    let targetPage = page
    if (filtersChanged) {
      targetPage = 1
      setPage(1)
    }

    if (
      targetPage !== lastLoadedRef.current.page ||
      searchTerm !== lastLoadedRef.current.searchTerm ||
      statusFilter !== lastLoadedRef.current.statusFilter ||
      currentTab !== lastLoadedRef.current.tab
    ) {
      lastLoadedRef.current = { page: targetPage, searchTerm, statusFilter, tab: currentTab }
      loadData(targetPage)
    }
  }, [page, searchTerm, statusFilter, tabParam, loadData])

  const filteredCustomers = useMemo(() => {
    return rawCustomers || []
  }, [rawCustomers])

  const handleSaveQuickFilho = async () => {
    if (!quickFilhoForm.nome.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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
        toast({ title: "Filho cadastrado!", description: "Dados gravados com sucesso no sistema." })
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
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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
    setRapidoFilhoNãome("")
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
      origem: "Loja Física",
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

      // 3. Wallet details (Handled by useEffect on opening)

      // 5. Returns & Exchanges â€” using new SaleExchange + SaleReturn tables (Fase 1 migration)
      const returnsRes = await getCustomerExchangeReturns(customer.id)
      if (returnsRes.success && returnsRes.data) {
        setReturnsHistory(returnsRes.data.map((r: any) => ({
          id: r.id,
          type: r.type, // 'EXCHANGE' | 'RETURN'
          venda_id: r.originalSaleId,
          vendedor_nome: "Sistema",
          valor_credito: Number(r.totalCredit),
          refundMethod: r.refundMethod,
          financialProcessed: r.financialProcessed,
          created_at: { seconds: new Date(r.createdAt).getTime() / 1000 }
        })))
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
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
    if (!form.whatsapp_principal.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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
          bYear = safeInteger(parts[0])
          bMonth = safeInteger(parts[1])
          bDay = safeInteger(parts[2])
        }
      }

      const cleanCpf = form.cpf ? form.cpf.replace(/\D/g, "") : null;
      const finalCpf = cleanCpf && cleanCpf.length === 11 ? form.cpf : null;

      const clientPayload = {
        name: form.nome,
        email: form.email || null,
        phone: cleanWhatsapp,
        cpf: finalCpf,
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
          toast({ title: "Cliente atualizado!", description: "Dados gravados com sucesso no sistema." })
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

      if (isCadastroRapido && rapidoFilhoNãome.trim()) {
        let dataNascCalculada = ""
        if (rapidoFilhoIdade) {
          const anos = safeNumber(rapidoFilhoIdade)
          if (anos !== null && anos >= 0) {
            const anoNasc = new Date().getFullYear() - anos
            dataNascCalculada = `${anoNasc}-06-15`
          }
        }

        batchFilhos = [{
          nome: rapidoFilhoNãome.trim(),
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
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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
        toast({ title: "Cliente arquivado", description: "O cliente foi movido para o arquivo do sistema." })
        await loadData()
      } else {
        toast({ variant: "destructive", title: "Erro ao excluir", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsDeleteOpen(false)
      setDeletingId(null)
    }
  }

  const handleSaveWalletAdjustment = async (authId?: string) => {
    const safeAdjust = safeNumber(adjustAmount);
    if (!safeAdjust || safeAdjust <= 0) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
    if (!adjustReason.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
    if (!walletInfo) return

    setIsSavingWallet(true)
    try {
      const res = await createManualAdjustmentAction({
        customerId: selectedCustomer.id,
        amount: safeAdjust,
        type: adjustType === "ENTRADA" ? "credit" : "debit",
        reason: adjustReason,
        authorizationId: authId
      })

      if (res.success) {
        toast({ title: "Saldo ajustado!", description: `Carteira atualizada no sistema.` })
        await loadData()
        // Reload details tab to show changes
        const freshData = rawCustomers?.find(c => c.id === selectedCustomer.id)
        if (freshData) {
          handleOpenDetails(freshData)
          await loadWalletData(selectedCustomer.id)
        }
        setIsAdjustingWallet(false)
        setAdjustAmount("")
        setAdjustReason("")
        setAuthorizationId("")
        setShowAuthDialog(false)
      } else {
        if (res.requireAuthorization) {
          setAuthorizationId(res.authorizationId)
          setShowAuthDialog(true)
        } else {
          toast({ variant: "destructive", title: "Erro ao processar ajuste", description: res.error })
        }
      }
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsSavingWallet(false)
    }
  }

  // Update client tags list
  const handleUpdateTags = async (tagNãome: string) => {
    if (!selectedCustomer) return
    const tagObj = availableTags.find(t => t.name === tagNãome)
    if (!tagObj) return

    try {
      if (selectedTags.includes(tagNãome)) {
        const relToDelete = selectedCustomer.tagRelations?.find((r: any) => r.tag?.name === tagNãome)
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
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <User className="h-8 w-8 text-indigo-600" /> Clientes e Responsáveis
          </h1>
          <p className="text-muted-foreground text-sm">Controle completo de clientes, responsáveis, filhos, tags e extrato de saldo.</p>
        </div>
        {can('CLIENTES', 'CREATE') && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-indigo-100 text-indigo-600 hover:bg-indigo-50/50 gap-2 h-10 font-semibold" onClick={() => handleOpenCreate(true)}>
              <PlusCircle className="h-4 w-4" /> Cadastro Rápido
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 gap-2 text-white h-10 font-semibold shadow-sm" onClick={() => handleOpenCreate(false)}>
              <UserPlus className="h-4 w-4" /> Cadastro Completo
            </Button>
          </div>
        )}
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
            <h3 className="font-semibold text-base">Aviso no Carregamento</h3>
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
          <p className="text-slate-600 font-semibold text-base">Nenhum cliente encontrado</p>
          <p className="text-muted-foreground text-sm mt-1">Refine a busca ou cadastre um novo cliente/responsável.</p>
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
                    {can('CLIENTES', 'UPDATE') && (
                      <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenEdit(customer)}>
                        <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar Ficha
                      </DropdownMenuItem>
                    )}
                    {can('CLIENTES', 'DELETE') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600 cursor-pointer" onClick={() => handleOpenDelete(customer.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Arquivar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <CardContent className="p-4 pt-1 space-y-3 text-xs">
                {/* Balance display */}
                <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between border">
                  <span className="text-slate-400 font-semibold uppercase text-[9px] flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-indigo-500" /> Crédito
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border rounded-xl shadow-sm mt-4">
          <div className="text-xs text-muted-foreground">
            Página <span className="font-semibold text-slate-700">{page}</span> de{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span> ({totalCount} cliente(s))
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs font-semibold"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs font-semibold"
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      {/* DIALOG ADD/EDIT CUSTOMER */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {editingCustomer ? "Editar Ficha de Cliente" : "Cadastrar Nãovo Cliente Responsável"}
            </DialogTitle>
            <DialogDescription>
              {isCadastroRapido ? "Preencha os campos essenciais para liberar a venda rapidamente." : "Registre os dados completos do comprador e vincule dependentes para segmentaâ”œºâ”œúo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="cnome">Nãome Completo *</Label>
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
                <Label htmlFor="cwhats2">WhatsApp Secundâ”œírio</Label>
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
                  <p className="text-muted-foreground italic">Nenhum filho cadastrado para este responsável.</p>
                ) : (
                  <div className="space-y-3">
                    {filhos.map((filho, idx) => (
                      <div key={idx} className="border p-3 rounded-lg bg-slate-50/50 space-y-3 relative">
                        <Button variant="ghost" size="icon" aria-label="Remover dependente" className="h-6 w-6 text-rose-500 absolute top-2 right-2" onClick={() => handleRemoveFilho(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Nãome do Filho *</Label>
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
                            <Label>Calçado</Label>
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
                <h4 className="font-bold text-indigo-950 uppercase text-[10px] tracking-wider block">Cadastro Rápido do Primeiro Filho</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nãome do Filho</Label>
                    <Input placeholder="Ex: Lucas" value={rapidoFilhoNãome} onChange={e => setRapidoFilhoNãome(e.target.value)} />
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
              <Label>Observações de Atendimento</Label>
              <Textarea placeholder="Histórico de alergias, marcas preferidas, restrições..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
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
              {editingCustomer ? "Salvar Alterações" : "Concluir Cadastro"}
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
              Deseja arquivar este cliente? O saldo atual da carteira permanecerâ”œí congelado, mas o cadastro nâ”œúo constarâ”œí nas listagens de vendas ativas.
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
              <TabsTrigger value="ficha" className="flex items-center gap-1.5">Ficha Bâ”œísica</TabsTrigger>
              <TabsTrigger value="filhos" className="flex items-center gap-1.5"><Baby className="h-4 w-4 text-emerald-600" /> Dependentes ({filhos.length})</TabsTrigger>
              <TabsTrigger value="carteira" className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-indigo-600" /> Créditos/Carteira</TabsTrigger>
              <TabsTrigger value="trocas" className="flex items-center gap-1.5">Trocas ({returnsHistory.length})</TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-1.5"><History className="h-4 w-4" /> Histórico CRM ({historyLogs.length})</TabsTrigger>
            </TabsList>

            {/* TAB: Ficha Bâ”œísica */}
            <TabsContent value="ficha" className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">CPF</span>
                    <span className="text-slate-800 font-medium block mt-1">{selectedCustomer?.cpf || "Nâ”œúo informado"}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Data de Nascimento</span>
                    <span className="text-slate-800 font-medium block mt-1">
                      {selectedCustomer?.data_nascimento ? new Date(selectedCustomer.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "Nâ”œúo informada"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedCustomer?.observacoes && (
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <span className="text-slate-400 font-semibold block uppercase text-[10px]">Nãotas de Atendimento</span>
                      <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed">{selectedCustomer?.observacoes}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Etiquetas de Segmentaâ”œºâ”œúo</span>
                    
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {availableTags.map((tag) => {
                        const active = selectedTags.includes(tag.name)
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleUpdateTags(tag.name)}
                            disabled={!can('CLIENTES', 'UPDATE')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                              active
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
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
                <h3 className="font-bold text-slate-800 text-sm">Crianâ”œºas Associadas</h3>
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 h-8 text-[11px]" onClick={() => setIsQuickAddFilhoOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar Crianâ”œºa
                </Button>
              </div>

              {filhos.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
                  Sem crianças vinculadas a este responsável.
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
                                {new Date(filho.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")} à {calcIdade(filho.data_nascimento)}
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
                            Calçado: {filho.tamanho_calcado}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* TAB: Carteira de Créditos */}
            <TabsContent value="carteira" className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Saldo Disponível</span>
                    <strong className="text-2xl text-indigo-600 block mt-1">R$ {walletInfo?.saldo_atual?.toFixed(2) || "0.00"}</strong>
                  </div>
                  {can('CARTEIRA', 'UPDATE') && (
                    <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 mt-3 w-full" onClick={() => setIsAdjustingWallet(true)}>
                      <PlusCircle className="h-4 w-4" /> Ajuste Manual
                    </Button>
                  )}
                </div>

                <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Total Créditos (Filtro)</span>
                  <strong className="text-2xl text-emerald-600 block mt-1">R$ {walletInfo?.total_creditos?.toFixed(2) || "0.00"}</strong>
                </div>

                <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-xl">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Total Débitos (Filtro)</span>
                  <strong className="text-2xl text-rose-600 block mt-1">R$ {walletInfo?.total_debitos?.toFixed(2) || "0.00"}</strong>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-slate-50 p-3 rounded-xl border grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Início</label>
                  <Input
                    type="date"
                    className="h-8 text-xs bg-white"
                    value={walletFilterStartDate}
                    onChange={e => setWalletFilterStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Fim</label>
                  <Input
                    type="date"
                    className="h-8 text-xs bg-white"
                    value={walletFilterEndDate}
                    onChange={e => setWalletFilterEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipo</label>
                  <select
                    className="w-full border rounded h-8 px-2 text-xs bg-white"
                    value={walletFilterType}
                    onChange={e => setWalletFilterType(e.target.value)}
                  >
                    <option value="ALL">Todos os Tipos</option>
                    <option value="CREDIT">Crédito (Manual)</option>
                    <option value="DEBIT">Débito</option>
                    <option value="BONUS">Bônus</option>
                    <option value="ADJUSTMENT">Ajuste</option>
                    <option value="REFUND">Reembolso</option>
                    <option value="EXCHANGE">Troca</option>
                    <option value="EXPIRATION">Expiração</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Origem</label>
                  <select
                    className="w-full border rounded h-8 px-2 text-xs bg-white"
                    value={walletFilterOrigin}
                    onChange={e => setWalletFilterOrigin(e.target.value)}
                  >
                    <option value="ALL">Todas as Origens</option>
                    <option value="sale">Vendas</option>
                    <option value="exchange">Trocas</option>
                    <option value="return">Devoluções</option>
                    <option value="manual">Ajustes Manuais</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <h4 className="font-bold text-slate-800 text-sm">Histórico do Extrato</h4>
                {walletHistory.length === 0 ? (
                  <p className="text-muted-foreground italic text-center py-6">Nenhuma movimentação registrada.</p>
                ) : (
                  <div className="border rounded-xl divide-y bg-white max-h-64 overflow-y-auto">
                    {walletHistory.map((tx, idx) => {
                      const isNegative = tx.type === "DEBIT" || tx.type === "EXPIRATION";
                      const colorClass = isNegative ? "text-rose-600" : "text-emerald-600";
                      
                      return (
                        <div key={tx.id || idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[8px] font-bold h-4 ${isNegative ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                                {tx.type}
                              </Badge>
                              {tx.expiresAt && !isNegative && (
                                <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1 rounded border border-amber-100">
                                  Validade: {new Date(tx.expiresAt).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-medium text-slate-800 mt-1">{tx.description || "Sem descrição"}</p>
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              Saldos: R$ {tx.balanceBefore?.toFixed(2)} &rarr; R$ {tx.balanceAfter?.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right">
                            <strong className={`text-sm ${colorClass}`}>
                              {isNegative ? "-" : "+"} R$ {tx.amount?.toFixed(2)}
                            </strong>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              {new Date(tx.createdAt).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB: Trocas e Devoluções */}
            <TabsContent value="trocas" className="space-y-4 pt-4 text-xs">
              <h3 className="font-bold text-slate-800 text-sm">Histórico de Trocas (PDV)</h3>
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
                        <p className="text-[10px] text-muted-foreground mt-0.5">Responsável: {item.vendedor_nome || "Balcão"}</p>
                      </div>
                      <div className="text-right">
                        <strong className="text-indigo-600">R$ {(safeNumber(item.valor_credito ?? item.valor) ?? 0).toFixed(2)}</strong>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {item.created_at ? new Date(item.created_at.seconds * 1000).toLocaleString("pt-BR") : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB: Histórico CRM */}
            <TabsContent value="historico" className="space-y-4 pt-4 text-xs">
              <h3 className="font-bold text-slate-800 text-sm">Histórico de Auditoria do Cliente</h3>
              {historyLogs.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
                  Sem registros de histórico.
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
            <DialogTitle className="text-base font-bold text-slate-800">Vincular Nãovo Filho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Nãome Completo</Label>
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
                <Label>Calçado</Label>
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
              <Label>Ação</Label>
              <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Adicionar Crédito (Entrada)</SelectItem>
                  <SelectItem value="SAIDA">Debitar Crédito (Saída)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Justificativa Obrigatâ”œâ”‚ria</Label>
              <Input placeholder="Ex: Ajuste manual" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsAdjustingWallet(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => handleSaveWalletAdjustment()} disabled={isSavingWallet}>
                {isSavingWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Ajuste"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AuthorizationDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        authorizationId={authorizationId}
        authorizationType={adjustType === "ENTRADA" ? "WALLET_CREDIT" : "WALLET_DEBIT"}
        title="Autorização de Ajuste"
        description="Este ajuste manual de saldo exige aprovação de um gerente."
        amount={safeNumber(adjustAmount) ?? 0}
        onAuthorized={(auth) => handleSaveWalletAdjustment(auth.id)}
      />

    </div>
  )
}
