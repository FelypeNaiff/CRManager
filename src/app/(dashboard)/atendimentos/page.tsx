"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Headset,
  Plus,
  ArrowLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"]
const STATUS_OPTIONS = ["Aberto", "Em Andamento", "Resolvido", "Fechado"]
const CANAIS = ["WhatsApp", "Telefone", "Presencial", "E-mail", "Instagram"]

const emptyForm = {
  titulo: "",
  descricao: "",
  prioridade: "Normal",
  status: "Aberto",
  canal: "WhatsApp",
  clienteNome: "",
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  "Aberto":       { icon: AlertCircle,  color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  "Em Andamento": { icon: Clock,        color: "text-blue-600",    bg: "bg-blue-50 border-blue-200" },
  "Resolvido":    { icon: CheckCircle,  color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "Fechado":      { icon: XCircle,      color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
}

const prioridadeColor: Record<string, string> = {
  "Baixa":   "bg-slate-100 text-slate-600",
  "Normal":  "bg-blue-100 text-blue-700",
  "Alta":    "bg-orange-100 text-orange-700",
  "Urgente": "bg-red-100 text-red-700",
}

export default function AtendimentosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clienteId = searchParams.get("clienteId")
  const clienteNome = searchParams.get("nome") || ""
  const db = useFirestore()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingAtend, setEditingAtend] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm, clienteNome: decodeURIComponent(clienteNome) })
  const [isSaving, setIsSaving] = useState(false)

  const atendimentosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "atendimentos"), orderBy("createdAt", "desc"))
  }, [db])

  const { data: allAtendimentos, isLoading } = useCollection(atendimentosQuery)

  // Filtra por cliente se vier da página de clientes, senão mostra todos
  const atendimentos = (allAtendimentos || [])
    .filter(a => clienteId ? a.clienteId === clienteId : true)
    .filter(a => filterStatus === "todos" ? true : a.status === filterStatus)
    .filter(a =>
      a.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.clienteNome?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const openNewDialog = () => {
    setEditingAtend(null)
    setForm({ ...emptyForm, clienteNome: decodeURIComponent(clienteNome) })
    setIsDialogOpen(true)
  }

  const openEditDialog = (atend: any) => {
    setEditingAtend(atend)
    setForm({
      titulo: atend.titulo || "",
      descricao: atend.descricao || "",
      prioridade: atend.prioridade || "Normal",
      status: atend.status || "Aberto",
      canal: atend.canal || "WhatsApp",
      clienteNome: atend.clienteNome || "",
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast({ variant: "destructive", title: "Título obrigatório", description: "Preencha o título do atendimento." })
      return
    }
    setIsSaving(true)
    try {
      if (editingAtend) {
        await updateDoc(doc(db, "atendimentos", editingAtend.id), {
          ...form,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Atendimento atualizado!" })
      } else {
        await addDoc(collection(db, "atendimentos"), {
          ...form,
          clienteId: clienteId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Atendimento aberto!", description: `"${form.titulo}" foi registrado.` })
      }
      setIsDialogOpen(false)
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "atendimentos", deletingId))
      toast({ title: "Atendimento excluído." })
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  const counts = {
    Aberto: (allAtendimentos || []).filter(a => a.status === "Aberto").length,
    "Em Andamento": (allAtendimentos || []).filter(a => a.status === "Em Andamento").length,
    Resolvido: (allAtendimentos || []).filter(a => a.status === "Resolvido").length,
    Fechado: (allAtendimentos || []).filter(a => a.status === "Fechado").length,
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
              <Headset className="h-8 w-8 text-primary" /> Atendimentos
            </h1>
            {clienteId ? (
              <p className="text-muted-foreground">Tickets de <span className="font-semibold text-foreground">{decodeURIComponent(clienteNome)}</span></p>
            ) : (
              <p className="text-muted-foreground">Gerencie todos os atendimentos e chamados abertos.</p>
            )}
          </div>
        </div>
        <Button className="gap-2" onClick={openNewDialog}>
          <Plus className="h-4 w-4" /> Novo Atendimento
        </Button>
      </div>

      {/* Status Cards - só mostra na visão geral */}
      {!clienteId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(statusConfig) as [string, typeof statusConfig[string]][]).map(([status, cfg]) => {
            const Icon = cfg.icon
            return (
              <Card
                key={status}
                className={`cursor-pointer border transition-all ${filterStatus === status ? "ring-2 ring-primary" : ""} ${cfg.bg}`}
                onClick={() => setFilterStatus(filterStatus === status ? "todos" : status)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{status}</p>
                    <p className={`text-2xl font-bold ${cfg.color}`}>{counts[status as keyof typeof counts] || 0}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${cfg.color} opacity-70`} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Busca */}
      <div className="flex items-center gap-4 bg-background p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou cliente..."
            className="pl-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando atendimentos...</p>
        </div>
      ) : atendimentos.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <Headset className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum atendimento encontrado.</p>
          <p className="text-muted-foreground text-sm mt-1">Abra um novo atendimento para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {atendimentos.map((atend) => {
            const cfg = statusConfig[atend.status] || statusConfig["Aberto"]
            const Icon = cfg.icon
            return (
              <Card key={atend.id} className={`border transition-all hover:shadow-sm ${cfg.bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{atend.titulo}</h3>
                          <Badge className={`text-[10px] h-5 border shrink-0 ${prioridadeColor[atend.prioridade] || ""}`}>
                            {atend.prioridade}
                          </Badge>
                        </div>
                        {atend.clienteNome && (
                          <p className="text-sm text-muted-foreground mt-0.5">Cliente: {atend.clienteNome}</p>
                        )}
                        {atend.descricao && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{atend.descricao}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Canal: {atend.canal}</span>
                          {atend.createdAt?.toDate && (
                            <span>{atend.createdAt.toDate().toLocaleDateString("pt-BR")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{atend.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(atend)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(atend.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAtend ? "Editar Atendimento" : "Novo Atendimento"}</DialogTitle>
            <DialogDescription>
              {editingAtend ? "Atualize os dados do atendimento." : "Registre um novo chamado ou atendimento."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="atitulo">Título *</Label>
              <Input id="atitulo" placeholder="Resumo do atendimento" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />
            </div>
            {!clienteId && (
              <div className="space-y-2">
                <Label htmlFor="aclienteNome">Nome do Cliente</Label>
                <Input id="aclienteNome" placeholder="Nome do cliente (se aplicável)" value={form.clienteNome} onChange={e => setForm(p => ({ ...p, clienteNome: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="adesc">Descrição</Label>
              <Textarea id="adesc" placeholder="Detalhes do atendimento..." rows={3} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={form.canal} onValueChange={v => setForm(p => ({ ...p, canal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAtend ? "Salvar" : "Abrir Atendimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendimento será permanentemente removido.
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
