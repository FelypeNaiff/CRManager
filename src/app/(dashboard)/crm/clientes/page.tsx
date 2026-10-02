"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Baby, User, UserPlus, Settings, FileSpreadsheet, FileText, Download, Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

import { toast } from "@/hooks/use-toast"
import { useProfile } from "@/lib/contexts/profile-context"
import { usePermissions } from "@/hooks/use-permissions"
import { getCustomersPageData, deleteCustomer, getBirthdayList } from "@/lib/crm/actions"
import { safeNumber } from "@/lib/utils/form-normalizer"

import { CustomerFilters } from "./_components/customer-filters"
import { CustomerTable } from "./_components/customer-table"
import { CustomerDialog } from "./_components/customer-dialog"
import { CustomerDetailsSheet } from "./_components/details/customer-details-sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

export default function ClientesPage() {
  const { activeProfile } = useProfile()
  const { can } = usePermissions()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ativo")

  useEffect(() => {
    const statusParam = searchParams?.get("status")
    if (statusParam) {
      setStatusFilter(statusParam)
    }
  }, [searchParams])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isCadastroRapido, setIsCadastroRapido] = useState(false)

  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [rawCustomers, setRawCustomers] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [walletsMap, setWalletsMap] = useState<Record<string, number>>({})

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const tabParam = searchParams?.get("tab") || undefined
  const isBirthdayView = tabParam === "aniversariantes"
  const [birthdayMonth, setBirthdayMonth] = useState(new Date().getMonth() + 1)
  const [birthdayDay, setBirthdayDay] = useState("")
  const [birthdayChildren, setBirthdayChildren] = useState<any[]>([])
  const [isLoadingBirthdays, setIsLoadingBirthdays] = useState(false)

  useEffect(() => {
    if (!isBirthdayView) return
    setIsLoadingBirthdays(true)
    getBirthdayList(birthdayMonth, birthdayDay ? Number(birthdayDay) : undefined)
      .then(result => setBirthdayChildren(result.success ? result.children || [] : []))
      .finally(() => setIsLoadingBirthdays(false))
  }, [isBirthdayView, birthdayMonth, birthdayDay])

  const loadData = useCallback(async (currentPage: number = page) => {
    setIsLoading(true)
    setError(null)
    try {
      const { customers: custRes, tags: tagsRes } = await getCustomersPageData({
        page: currentPage,
        pageSize: 50,
        search: searchTerm,
        status: statusFilter,
        tab: tabParam
      })

      if (custRes.success && custRes.data && custRes.metadata) {
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
      setError("Não foi possível carregar os clientes.")
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

  const filteredCustomers = useMemo(() => rawCustomers || [], [rawCustomers])

  const handleOpenCreate = (rapido: boolean = false) => {
    setEditingCustomer(null)
    setIsCadastroRapido(rapido)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (customer: any) => {
    setEditingCustomer(customer)
    setIsCadastroRapido(false)
    setIsFormOpen(true)
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleOpenDetails = (customer: any) => {
    setSelectedCustomer(customer)
    setIsDetailsOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await deleteCustomer(deletingId)
      if (res.success) {
        toast({ title: "Cliente arquivado" })
        await loadData()
      } else {
        toast({ variant: "destructive", title: "Erro ao excluir", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." })
    } finally {
      setIsDeleteOpen(false)
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
            {isBirthdayView ? <Baby className="h-8 w-8 text-indigo-600" /> : <User className="h-8 w-8 text-indigo-600" />} {isBirthdayView ? "Aniversariantes — Filhos" : "Clientes e Responsáveis"}
          </h1>
          <p className="text-muted-foreground text-sm">{isBirthdayView ? "Relação de filhos e dependentes aniversariantes por mês e dia." : "Controle completo de clientes, responsáveis, filhos, tags e extrato de saldo."}</p>
        </div>
        {!isBirthdayView && can('CLIENTES', 'CREATE') && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-indigo-100 text-indigo-600 hover:bg-indigo-50/50 gap-2 h-10 font-semibold" onClick={() => handleOpenCreate(true)}>
              <Baby className="h-4 w-4" /> Cadastro Rápido
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 gap-2 text-white h-10 font-semibold shadow-sm" onClick={() => handleOpenCreate(false)}>
              <UserPlus className="h-4 w-4" /> Cadastro Completo
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 font-semibold gap-2 border-slate-200">
                  <Settings className="h-4 w-4 text-slate-500" /> Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-medium text-slate-700">
                <DropdownMenuItem className="gap-2 cursor-pointer py-2" onClick={() => toast({ title: "Em breve", description: "Importação de planilha em desenvolvimento." })}>
                  <FileSpreadsheet className="h-4 w-4 text-slate-500" /> Importar de uma planilha
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer py-2" onClick={() => toast({ title: "Em breve", description: "Importação de NFe em desenvolvimento." })}>
                  <FileText className="h-4 w-4 text-slate-500" /> Importar de notas fiscais
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer py-2" onClick={() => toast({ title: "Em breve", description: "Exportação em desenvolvimento." })}>
                  <Download className="h-4 w-4 text-slate-500" /> Exportar clientes
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer py-2" onClick={() => toast({ title: "Em breve", description: "Exportação de e-mails em desenvolvimento." })}>
                  <Mail className="h-4 w-4 text-slate-500" /> Exportar e-mails
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer py-2 text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => toast({ title: "Em breve", description: "Exclusão em lote em desenvolvimento." })}>
                  <Trash2 className="h-4 w-4" /> Excluir clientes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CustomerFilters
        isBirthdayView={isBirthdayView}
        birthdayMonth={birthdayMonth}
        setBirthdayMonth={setBirthdayMonth}
        birthdayDay={birthdayDay}
        setBirthdayDay={setBirthdayDay}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        canCreate={can('CLIENTES', 'CREATE')}
        onOpenCreate={handleOpenCreate}
      />

      <CustomerTable
        customers={filteredCustomers}
        isLoading={isLoading}
        error={error}
        walletsMap={walletsMap}
        canUpdate={can('CLIENTES', 'UPDATE')}
        canDelete={can('CLIENTES', 'DELETE')}
        onOpenEdit={handleOpenEdit}
        onOpenDetails={handleOpenDetails}
        onOpenDelete={handleOpenDelete}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        totalCount={totalCount}
        isBirthdayView={isBirthdayView}
        birthdayChildren={birthdayChildren}
        isLoadingBirthdays={isLoadingBirthdays}
      />

      <CustomerDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingCustomer={editingCustomer}
        isCadastroRapido={isCadastroRapido}
        onSuccess={() => loadData(page)}
      />

      <CustomerDetailsSheet
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        customer={selectedCustomer}
        availableTags={availableTags}
        canUpdate={can('CLIENTES', 'UPDATE')}
        onUpdate={() => loadData(page)}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-slate-800">Inativar Ficha do Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja arquivar este cliente? O saldo atual da carteira permanecerá congelado.
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
    </div>
  )
}
