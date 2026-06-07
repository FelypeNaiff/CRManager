"use client"

import { useState } from "react"
import { useCollection, useMemoFirebase, useFirestore } from "@/lib/legacy-stubs"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "@/lib/legacy-firestore-stubs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { Settings, CreditCard, Tag, Plus, Edit2, Trash2, Search, MoreVertical, Pencil, Loader2, FolderTree, Building } from "lucide-react"
import { safeInteger, safeNumber } from "@/lib/utils/form-normalizer"

// ==========================================
// COMPONENTE: FORMAS DE PAGAMENTO
// ==========================================
function PaymentMethodsTab({ db }: { db: any }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    feePercentage: 0,
    feeFixed: 0,
    receiptDays: 0,
  })

  const colQuery = useMemoFirebase(() => collection(db, "payment_methods"), [db])
  const { data, isLoading } = useCollection(colQuery)

  const filteredData = (data || []).filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    await updateDoc(doc(db, "payment_methods", id), {
      status: currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      updatedAt: serverTimestamp()
    })
    toast({ title: "Status atualizado" })
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    setIsSaving(true)
    try {
      const dataToSave = {
        name: form.name,
        feePercentage: safeNumber(form.feePercentage) ?? 0,
        feeFixed: safeNumber(form.feeFixed) ?? 0,
        receiptDays: safeInteger(form.receiptDays) ?? 0,
        updatedAt: serverTimestamp(),
      }

      if (editingItem) {
        await updateDoc(doc(db, "payment_methods", editingItem.id), dataToSave)
        toast({ title: "Forma de pagamento atualizada!" })
      } else {
        await addDoc(collection(db, "payment_methods"), {
          ...dataToSave,
          isSystem: false,
          status: "ACTIVE",
          createdAt: serverTimestamp(),
        })
        toast({ title: "Forma de pagamento cadastrada!" })
      }
      setIsDialogOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "payment_methods", deletingId))
      toast({ title: "Excluído com sucesso" })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button onClick={() => { setEditingItem(null); setForm({name:"", feePercentage:0, feeFixed:0, receiptDays:0}); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nãova Forma
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nãome</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead>Taxa Fixa (R$)</TableHead>
                  <TableHead>Recebimento (Dias)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.name}
                        {item.isSystem && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{item.feePercentage}%</TableCell>
                    <TableCell>R$ {item.feeFixed.toFixed(2)}</TableCell>
                    <TableCell>{item.receiptDays} dias</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={item.status === "ACTIVE"} onCheckedChange={() => handleToggleStatus(item.id, item.status)} disabled={item.isSystem} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingItem(item); setForm(item); setIsDialogOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {!item.isSystem && (
                            <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingId(item.id); setIsDeleteOpen(true); }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Forma de Pagamento" : "Nãova Forma de Pagamento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nãome *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} disabled={editingItem?.isSystem} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taxa Percentual (%)</Label>
                <Input type="number" step="0.01" value={form.feePercentage} onChange={(e) => setForm({...form, feePercentage: e.target.value as any})} />
              </div>
              <div className="space-y-2">
                <Label>Taxa Fixa (R$)</Label>
                <Input type="number" step="0.01" value={form.feeFixed} onChange={(e) => setForm({...form, feeFixed: e.target.value as any})} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Prazo de Recebimento (Dias)</Label>
                <Input type="number" value={form.receiptDays} onChange={(e) => setForm({...form, receiptDays: e.target.value as any})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==========================================
// COMPONENTE: PLANO DE CONTAS
// ==========================================
function ChartOfAccountsTab({ db }: { db: any }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "EXPENSE",
    parentId: "",
  })

  const colQuery = useMemoFirebase(() => collection(db, "chart_of_accounts"), [db])
  const { data, isLoading } = useCollection(colQuery)

  const filteredData = (data || []).filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.code?.includes(searchTerm)
  ).sort((a: any, b: any) => a.code.localeCompare(b.code))

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    await updateDoc(doc(db, "chart_of_accounts", id), {
      status: currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      updatedAt: serverTimestamp()
    })
    toast({ title: "Status atualizado" })
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    setIsSaving(true)
    try {
      const dataToSave = {
        code: form.code,
        name: form.name,
        type: form.type,
        parentId: form.parentId || null,
        updatedAt: serverTimestamp(),
      }

      if (editingItem) {
        await updateDoc(doc(db, "chart_of_accounts", editingItem.id), dataToSave)
        toast({ title: "Conta atualizada!" })
      } else {
        await addDoc(collection(db, "chart_of_accounts"), {
          ...dataToSave,
          isSystem: false,
          status: "ACTIVE",
          createdAt: serverTimestamp(),
        })
        toast({ title: "Conta cadastrada!" })
      }
      setIsDialogOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "chart_of_accounts", deletingId))
      toast({ title: "Excluído com sucesso" })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código ou nome..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button onClick={() => { setEditingItem(null); setForm({code:"", name:"", type:"EXPENSE", parentId:""}); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nãova Conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nãome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.name}
                        {item.isSystem && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.type === "REVENUE" ? "default" : "destructive"} className="text-[10px]">
                        {item.type === "REVENUE" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={item.status === "ACTIVE"} onCheckedChange={() => handleToggleStatus(item.id, item.status)} disabled={item.isSystem} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingItem(item); setForm({code: item.code, name: item.name, type: item.type, parentId: item.parentId || ""}); setIsDialogOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {!item.isSystem && (
                            <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingId(item.id); setIsDeleteOpen(true); }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Categoria" : "Nãova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código * (Ex: 2.1.5)</Label>
                <Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} disabled={editingItem?.isSystem} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})} disabled={editingItem?.isSystem}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REVENUE">Receita</SelectItem>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nãome *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} disabled={editingItem?.isSystem} />
            </div>
            <div className="space-y-2">
              <Label>Conta Pai (Opcional)</Label>
              <Select value={form.parentId} onValueChange={(v) => setForm({...form, parentId: v === "null" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Nenhum (Raiz)"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhum (Raiz)</SelectItem>
                  {data?.filter((d: any) => d.id !== editingItem?.id).sort((a:any, b:any) => a.code.localeCompare(b.code)).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==========================================
// COMPONENTE: CENTROS DE CUSTO
// ==========================================
function CostCentersTab({ db }: { db: any }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({ name: "", description: "" })

  const colQuery = useMemoFirebase(() => collection(db, "cost_centers"), [db])
  const { data, isLoading } = useCollection(colQuery)

  const filteredData = (data || []).filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    await updateDoc(doc(db, "cost_centers", id), {
      status: currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      updatedAt: serverTimestamp()
    })
    toast({ title: "Status atualizado" })
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    setIsSaving(true)
    try {
      const dataToSave = {
        name: form.name,
        description: form.description,
        updatedAt: serverTimestamp(),
      }

      if (editingItem) {
        await updateDoc(doc(db, "cost_centers", editingItem.id), dataToSave)
        toast({ title: "Centro de Custo atualizado!" })
      } else {
        await addDoc(collection(db, "cost_centers"), {
          ...dataToSave,
          status: "ACTIVE",
          createdAt: serverTimestamp(),
        })
        toast({ title: "Centro de Custo cadastrado!" })
      }
      setIsDialogOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "cost_centers", deletingId))
      toast({ title: "Excluído com sucesso" })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button onClick={() => { setEditingItem(null); setForm({name:"", description:""}); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nãovo Centro de Custo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nãome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={item.status === "ACTIVE"} onCheckedChange={() => handleToggleStatus(item.id, item.status)} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingItem(item); setForm(item); setIsDialogOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingId(item.id); setIsDeleteOpen(true); }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Centro de Custo" : "Nãovo Centro de Custo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nãome *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Ex: Matriz, Loja 1, Marketing" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
export default function OpcoesAuxiliaresPage() {
  const db = useFirestore()

  if (!db) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Opções Auxiliares</h1>
        <p className="text-muted-foreground">Configurações globais para o módulo financeiro.</p>
      </div>

      <Tabs defaultValue="payment_methods" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="payment_methods" className="gap-2"><CreditCard className="h-4 w-4"/> Formas de Pagamento</TabsTrigger>
          <TabsTrigger value="chart_of_accounts" className="gap-2"><FolderTree className="h-4 w-4"/> Plano de Contas</TabsTrigger>
          <TabsTrigger value="cost_centers" className="gap-2"><Building className="h-4 w-4"/> Centros de Custos</TabsTrigger>
        </TabsList>
        <TabsContent value="payment_methods">
          <PaymentMethodsTab db={db} />
        </TabsContent>
        <TabsContent value="chart_of_accounts">
          <ChartOfAccountsTab db={db} />
        </TabsContent>
        <TabsContent value="cost_centers">
          <CostCentersTab db={db} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
