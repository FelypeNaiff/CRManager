"use client"

import { useState } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/lib/legacy-stubs"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "@/lib/legacy-firestore-stubs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { Search, Plus, MoreVertical, Pencil, Trash2, Loader2, Building2, Banknote, ArrowUpDown, ArrowRightLeft, CreditCard } from "lucide-react"
import { safeNumber } from "@/lib/utils/form-normalizer"

const emptyForm = {
  name: "",
  type: "CHECKING",
  bankName: "",
  agency: "",
  accountNumber: "",
  initialBalance: 0,
}

export default function ContasBancariasPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()

  const contasQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "bank_accounts")
  }, [db])

  const { data: accounts, isLoading } = useCollection(contasQuery)

  const filteredAccounts = (accounts || []).filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.bankName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openNewDialog = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: any) => {
    setEditingItem(item)
    setForm({
      name: item.name || "",
      type: item.type || "CHECKING",
      bankName: item.bankName || "",
      agency: item.agency || "",
      accountNumber: item.accountNumber || "",
      initialBalance: item.initialBalance || 0,
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, "bank_accounts", id), {
        status: currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        updatedAt: serverTimestamp()
      })
      toast({ title: "Status atualizado" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar status" })
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o nome da conta." })
      return
    }

    setIsSaving(true)
    try {
      const dataToSave = {
        name: form.name,
        type: form.type,
        bankName: form.bankName,
        agency: form.agency,
        accountNumber: form.accountNumber,
        initialBalance: safeNumber(form.initialBalance) ?? 0,
        updatedAt: serverTimestamp(),
      }

      if (editingItem) {
        // Only update current balance differences if logic needed, for now just basic update
        // (In a real scenario, changing initialBalance after creation might need adjusting currentBalance)
        await updateDoc(doc(db, "bank_accounts", editingItem.id), dataToSave)
        toast({ title: "Conta atualizada!" })
      } else {
        await addDoc(collection(db, "bank_accounts"), {
          ...dataToSave,
          currentBalance: safeNumber(form.initialBalance) ?? 0,
          status: "ACTIVE",
          createdAt: serverTimestamp(),
        })
        toast({ title: "Conta cadastrada!" })
      }

      setIsDialogOpen(false)
      setForm(emptyForm)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "bank_accounts", deletingId))
      toast({ title: "Conta excluída" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
  }

  const formatType = (type: string) => {
    const types: any = {
      CHECKING: "Corrente",
      SAVINGS: "Poupança",
      CASH: "Dinheiro / Caixa",
      INVESTMENT: "Investimento"
    }
    return types[type] || type
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie as contas bancárias e caixas internos da empresa.</p>
        </div>
        <Button className="gap-2" onClick={openNewDialog}>
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 flex flex-row items-center justify-between border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta ou banco..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhuma conta encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo Atual</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {item.name}
                        {item.isSystem && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.bankName ? (
                        <div>
                          <div>{item.bankName}</div>
                          <div className="text-xs text-muted-foreground">Ag: {item.agency} | CC: {item.accountNumber}</div>
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatType(item.type)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {formatCurrency(item.currentBalance)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={item.status === "ACTIVE"}
                          onCheckedChange={() => handleToggleStatus(item.id, item.status)}
                          disabled={item.isSystem}
                        />
                        <span className="text-xs text-muted-foreground min-w-10">
                          {item.status === "ACTIVE" ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(item)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {!item.isSystem && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(item.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle>
            <DialogDescription>
              Preencha os dados da conta para lançamentos financeiros.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Conta *</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                placeholder="Ex: Itaú Empresa, Caixa Diário"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Conta</Label>
              <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECKING">Conta Corrente</SelectItem>
                  <SelectItem value="SAVINGS">Conta Poupança</SelectItem>
                  <SelectItem value="INVESTMENT">Investimento</SelectItem>
                  <SelectItem value="CASH">Dinheiro Espécie (Caixa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {form.type !== "CASH" && (
              <>
                <div className="space-y-2">
                  <Label>Nome do Banco</Label>
                  <Input 
                    value={form.bankName} 
                    onChange={(e) => setForm({...form, bankName: e.target.value})} 
                    placeholder="Ex: Itaú, Nubank, Bradesco"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input 
                      value={form.agency} 
                      onChange={(e) => setForm({...form, agency: e.target.value})} 
                      placeholder="Ex: 0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input 
                      value={form.accountNumber} 
                      onChange={(e) => setForm({...form, accountNumber: e.target.value})} 
                      placeholder="Ex: 00000-0"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Saldo Inicial (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                disabled={!!editingItem} // Usually initial balance shouldn't be edited after creation
                value={form.initialBalance} 
                onChange={(e) => setForm({...form, initialBalance: e.target.value as any})} 
              />
              {editingItem && <p className="text-xs text-muted-foreground">O saldo inicial não pode ser alterado após a criação.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta Bancária?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a conta bancária. Não será possível recuperá-la.
              Certifique-se de que não existem lançamentos vinculados a esta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
