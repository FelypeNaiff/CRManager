"use client"

import { useState } from "react"
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
  Search,
  UserPlus,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Tag,
  Loader2,
  Baby,
  Headset,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, query } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

const emptyForm = {
  nome: "",
  telefone: "",
  email: "",
  cpf: "",
  cidade: "",
  estado: "",
  cep: "",
  endereco: "",
  observacoes: "",
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

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [filhos, setFilhos] = useState<any[]>([])
  const [deletedFilhos, setDeletedFilhos] = useState<string[]>([])
  const db = useFirestore()
  const router = useRouter()

  const clientesQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "clientes")
  }, [db])

  const { data: customers, isLoading } = useCollection(clientesQuery)

  const filteredCustomers = (customers || []).filter(c =>
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone?.includes(searchTerm) ||
    c.cpf?.includes(searchTerm)
  )

  const openNewDialog = () => {
    setEditingCustomer(null)
    setForm(emptyForm)
    setFilhos([])
    setDeletedFilhos([])
    setIsDialogOpen(true)
  }

  const openEditDialog = async (customer: any) => {
    setEditingCustomer(customer)
    setForm({
      nome: customer.nome || "",
      telefone: customer.telefone || "",
      email: customer.email || "",
      cpf: customer.cpf || "",
      cidade: customer.cidade || "",
      estado: customer.estado || "",
      cep: customer.cep || "",
      endereco: customer.endereco || "",
      observacoes: customer.observacoes || "",
    })
    setIsDialogOpen(true)
    
    try {
      const filhosSnapshot = await getDocs(query(collection(db, "clientes", customer.id, "filhos")))
      const filhosData = filhosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setFilhos(filhosData)
      setDeletedFilhos([])
    } catch (e) {
      console.error("Erro ao carregar filhos:", e)
      setFilhos([])
    }
  }

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleAddFilho = () => {
    setFilhos([...filhos, { nome: "", dataNascimento: "", tamanhoRoupa: "" }])
  }

  const handleFilhoChange = (index: number, field: string, value: string) => {
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

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o nome do cliente." })
      return
    }
    if (!form.telefone.trim()) {
      toast({ variant: "destructive", title: "Telefone obrigatório", description: "Preencha o telefone do cliente." })
      return
    }
    setIsSaving(true)
    try {
      let currentClientId = editingCustomer?.id;
      if (editingCustomer) {
        await updateDoc(doc(db, "clientes", currentClientId), {
          ...form,
          ativo: true,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Cliente atualizado!", description: `${form.nome} foi atualizado com sucesso.` })
      } else {
        const newDocRef = await addDoc(collection(db, "clientes"), {
          ...form,
          ativo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          tags: [],
        })
        currentClientId = newDocRef.id
        toast({ title: "Cliente cadastrado!", description: `${form.nome} foi adicionado à base de clientes.` })
      }

      for (const filho of filhos) {
        if (!filho.nome.trim()) continue;
        if (filho.id) {
          await updateDoc(doc(db, "clientes", currentClientId, "filhos", filho.id), {
            nome: filho.nome,
            dataNascimento: filho.dataNascimento || "",
            tamanhoRoupa: filho.tamanhoRoupa || "",
            clientId: currentClientId,
            updatedAt: serverTimestamp(),
          })
        } else {
          await addDoc(collection(db, "clientes", currentClientId, "filhos"), {
            nome: filho.nome,
            dataNascimento: filho.dataNascimento || "",
            tamanhoRoupa: filho.tamanhoRoupa || "",
            clientId: currentClientId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      }

      for (const deletedId of deletedFilhos) {
        await deleteDoc(doc(db, "clientes", currentClientId, "filhos", deletedId))
      }

      setIsDialogOpen(false)
      setForm(emptyForm)
      setFilhos([])
      setDeletedFilhos([])
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar o cliente." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "clientes", deletingId))
      toast({ title: "Cliente excluído", description: "O cliente foi removido da base." })
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir", description: "Não foi possível excluir o cliente." })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  const field = (key: keyof typeof emptyForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes e histórico de contatos.</p>
        </div>
        <Button className="gap-2" onClick={openNewDialog}>
          <UserPlus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-background p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <p className="text-muted-foreground font-medium">Nenhum cliente encontrado.</p>
          <p className="text-muted-foreground text-sm mt-1">Clique em "Novo Cliente" para começar a cadastrar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="overflow-hidden group hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="p-4 pb-0 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {customer.nome?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{customer.nome}</h3>
                    <Badge variant={customer.ativo ? "default" : "secondary"} className="text-[10px] h-4 mt-1">
                      {customer.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/filhos?clienteId=${customer.id}&nome=${encodeURIComponent(customer.nome)}`)}>
                      <Baby className="mr-2 h-4 w-4" /> Ver Filhos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/atendimentos?clienteId=${customer.id}&nome=${encodeURIComponent(customer.nome)}`)}>
                      <Headset className="mr-2 h-4 w-4" /> Atendimentos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(customer.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {customer.telefone}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> {customer.email}
                    </div>
                  )}
                  {(customer.cidade || customer.estado) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {customer.cidade}{customer.estado ? `, ${customer.estado}` : ""}
                    </div>
                  )}
                </div>
                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {customer.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="bg-secondary/30 text-[10px] h-5 flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? "Atualize os dados do cliente." : "Preencha os dados para cadastrar um novo cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input id="nome" placeholder="Nome do cliente" {...field("nome")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" placeholder="000.000.000-00" {...field("cpf")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
              <Input id="telefone" placeholder="(00) 00000-0000" {...field("telefone")} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="cliente@email.com" {...field("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" placeholder="00000-000" {...field("cep")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" placeholder="Cidade" {...field("cidade")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" placeholder="SP" maxLength={2} {...field("estado")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" placeholder="Rua, número, bairro" {...field("endereco")} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input id="observacoes" placeholder="Anotações internas sobre o cliente..." {...field("observacoes")} />
            </div>

            {/* Gerenciamento de Filhos */}
            <div className="md:col-span-2 mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Baby className="h-5 w-5 text-primary" /> Filhos</h3>
                  <p className="text-sm text-muted-foreground">Adicione os filhos para campanhas e controle de estoque.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddFilho} className="border-primary/50 text-primary hover:bg-primary/10">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Filho
                </Button>
              </div>
              
              {filhos.length > 0 && (
                <div className="space-y-3">
                  {filhos.map((filho, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 p-4 border rounded-xl bg-primary/5 glass-card relative group">
                      <div className="flex-1 space-y-2">
                        <Label>Nome da Criança</Label>
                        <Input 
                          placeholder="Nome" 
                          value={filho.nome} 
                          onChange={(e) => handleFilhoChange(index, "nome", e.target.value)} 
                          className="bg-background/50"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Data de Nascimento</Label>
                          {filho.dataNascimento && (
                            <span className="text-xs text-primary font-medium">{calcIdade(filho.dataNascimento)}</span>
                          )}
                        </div>
                        <Input 
                          type="date" 
                          value={filho.dataNascimento} 
                          onChange={(e) => handleFilhoChange(index, "dataNascimento", e.target.value)} 
                          className="bg-background/50"
                        />
                      </div>
                      <div className="w-full sm:w-[120px] space-y-2">
                        <Label>Tamanho</Label>
                        <Select value={filho.tamanhoRoupa || ""} onValueChange={(v) => handleFilhoChange(index, "tamanhoRoupa", v)}>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Tamanho" />
                          </SelectTrigger>
                          <SelectContent>
                            {["RN", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-2 top-2 sm:relative sm:right-auto sm:top-auto sm:self-end sm:mb-0.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveFilho(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCustomer ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente e seus dados serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
