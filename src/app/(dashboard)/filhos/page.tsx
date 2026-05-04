"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Baby, Plus, ArrowLeft, MoreVertical, Pencil, Trash2, Loader2, Cake } from "lucide-react"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

const emptyForm = {
  nome: "",
  dataNascimento: "",
  sexo: "",
  observacoes: "",
}

function calcIdade(dataNascimento: string): string {
  if (!dataNascimento) return ""
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()
  if (meses < 0) { anos--; meses += 12 }
  if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""}`
  return `${meses} mês${meses > 1 ? "es" : ""}`
}

export default function FilhosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clienteId = searchParams.get("clienteId")
  const clienteNome = searchParams.get("nome") || "Cliente"
  const db = useFirestore()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingFilho, setEditingFilho] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const filhosQuery = useMemoFirebase(() => {
    if (!db || !clienteId) return null
    return query(collection(db, "clientes", clienteId, "filhos"))
  }, [db, clienteId])

  const { data: filhos, isLoading } = useCollection(filhosQuery)

  const openNewDialog = () => {
    setEditingFilho(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (filho: any) => {
    setEditingFilho(filho)
    setForm({
      nome: filho.nome || "",
      dataNascimento: filho.dataNascimento || "",
      sexo: filho.sexo || "",
      observacoes: filho.observacoes || "",
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o nome da criança." })
      return
    }
    if (!clienteId) return

    setIsSaving(true)
    try {
      if (editingFilho) {
        await updateDoc(doc(db, "clientes", clienteId, "filhos", editingFilho.id), {
          ...form,
          clientId: clienteId,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Filho atualizado!", description: `${form.nome} foi atualizado.` })
      } else {
        await addDoc(collection(db, "clientes", clienteId, "filhos"), {
          ...form,
          clientId: clienteId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Filho cadastrado!", description: `${form.nome} foi adicionado.` })
      }
      setIsDialogOpen(false)
      setForm(emptyForm)
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId || !clienteId) return
    try {
      await deleteDoc(doc(db, "clientes", clienteId, "filhos", deletingId))
      toast({ title: "Filho excluído", description: "Registro removido com sucesso." })
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
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

  const sexoColor = (sexo: string) => {
    if (sexo === "M") return "bg-blue-100 text-blue-700 border-blue-200"
    if (sexo === "F") return "bg-pink-100 text-pink-700 border-pink-200"
    return "bg-secondary/30 text-secondary-foreground"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {clienteId && (
            <Button variant="ghost" size="icon" onClick={() => router.push("/clientes")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center gap-2">
              <Baby className="h-8 w-8 text-primary" /> Filhos
            </h1>
            {clienteId && (
              <p className="text-muted-foreground">Crianças vinculadas a <span className="font-semibold text-foreground">{decodeURIComponent(clienteNome)}</span></p>
            )}
            {!clienteId && (
              <p className="text-muted-foreground">Selecione um cliente para ver os filhos cadastrados.</p>
            )}
          </div>
        </div>
        {clienteId && (
          <Button className="gap-2" onClick={openNewDialog}>
            <Plus className="h-4 w-4" /> Cadastrar Filho
          </Button>
        )}
      </div>

      {!clienteId ? (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <Baby className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum cliente selecionado</p>
          <p className="text-muted-foreground text-sm mt-1">Acesse pelo menu de opções de um cliente.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/clientes")}>
            Ir para Clientes
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : !filhos || filhos.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <Baby className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum filho cadastrado ainda.</p>
          <p className="text-muted-foreground text-sm mt-1">Clique em "Cadastrar Filho" para adicionar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filhos.map((filho) => (
            <Card key={filho.id} className="hover:border-primary/50 transition-colors shadow-sm group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${filho.sexo === "F" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}`}>
                      {filho.nome?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-bold text-base group-hover:text-primary transition-colors">{filho.nome}</p>
                      {filho.dataNascimento && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Cake className="h-3 w-3" />
                          {new Date(filho.dataNascimento + "T12:00:00").toLocaleDateString("pt-BR")} · {calcIdade(filho.dataNascimento)}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(filho)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(filho.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {filho.sexo && (
                  <div className="mt-3">
                    <Badge className={`text-[10px] h-5 border ${sexoColor(filho.sexo)}`}>
                      {filho.sexo === "M" ? "Masculino" : filho.sexo === "F" ? "Feminino" : filho.sexo}
                    </Badge>
                  </div>
                )}
                {filho.observacoes && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{filho.observacoes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFilho ? "Editar Filho" : "Cadastrar Filho"}</DialogTitle>
            <DialogDescription>
              {editingFilho ? "Atualize os dados da criança." : "Preencha os dados para vincular uma criança ao cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fnome">Nome da Criança *</Label>
              <Input id="fnome" placeholder="Nome completo" {...field("nome")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fnasc">Data de Nascimento</Label>
                <Input id="fnasc" type="date" {...field("dataNascimento")} />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={v => setForm(p => ({ ...p, sexo: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fobs">Observações</Label>
              <Input id="fobs" placeholder="Alergias, preferências, etc." {...field("observacoes")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFilho ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro da criança será permanentemente removido.
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
