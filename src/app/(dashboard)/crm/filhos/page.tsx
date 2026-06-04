"use client"

import { Suspense, useMemo, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { safeInteger } from "@/lib/utils/form-normalizer"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Baby, Plus, ArrowLeft, MoreVertical, Pencil, Trash2, Loader2, Cake, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getChildren, getCustomers, createChild, updateChild, deleteChild } from "@/lib/crm/actions"
import { usePermissions } from "@/hooks/use-permissions"

const emptyForm = {
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

function getIdadeEmAnos(dataNascimento: string): number | null {
  if (!dataNascimento) return null
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let anos = hoje.getFullYear() - nasc.getFullYear()
  const mes = hoje.getMonth() - nasc.getMonth()
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) anos--
  return anos >= 0 ? anos : 0
}

function FilhosPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { can } = usePermissions()
  const clienteId = searchParams.get("clienteId")
  const clienteNome = searchParams.get("nome") || "Cliente"
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingFilho, setEditingFilho] = useState<any>(null)
  const [deletingFilho, setDeletingFilho] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  
  // Filters
  const [sexoFilter, setSexoFilter] = useState("todos")
  const [idadeMin, setIdadeMin] = useState("")
  const [idadeMax, setIdadeMax] = useState("")
  const [tamanhoFilter, setTamanhoFilter] = useState("todos")

  // Supabase states
  const [filhos, setFilhos] = useState<any[] | null>(null)
  const [clientes, setClientes] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [filhosRes, clientesRes] = await Promise.all([
        getChildren(clienteId || undefined),
        getCustomers()
      ])

      if (filhosRes.success && filhosRes.data) {
        const mapped = filhosRes.data.map((f: any) => ({
          id: f.id,
          cliente_id: f.customerId,
          nome: f.name,
          data_nascimento: f.birthDate ? new Date(f.birthDate).toISOString().substring(0, 10) : "",
          sexo: f.gender || "",
          tamanho_roupa: f.clothingSize || "2",
          tamanho_calcado: f.shoeSize || "",
          observacoes: f.notes || "",
          status: "ativo"
        }))
        setFilhos(mapped)
      } else {
        setError(filhosRes.error || "Erro ao carregar lista de filhos.")
      }

      if (clientesRes.success && clientesRes.data) {
        setClientes(clientesRes.data)
      }
    } catch (e: any) {
      console.error(e)
      setError("Falha ao carregar dados de filhos do CRM.")
    } finally {
      setIsLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const clientesMap = useMemo(() => {
    return (clientes || []).reduce((acc: Record<string, string>, c: any) => {
      acc[c.id] = c.name || "Cliente Desconhecido"
      return acc
    }, {})
  }, [clientes])

  const filteredFilhos = useMemo(() => {
    if (!filhos) return []
    return filhos.filter((f: any) => {
      if (sexoFilter !== "todos" && f.sexo !== sexoFilter) return false
      if (tamanhoFilter !== "todos" && f.tamanho_roupa !== tamanhoFilter) return false

      const dataNasc = f.data_nascimento
      const idade = getIdadeEmAnos(dataNasc)
      
      if (idadeMin) {
        const min = safeInteger(idadeMin)
        if (min !== null && (idade === null || idade < min)) return false
      }
      if (idadeMax) {
        const max = safeInteger(idadeMax)
        if (max !== null && (idade === null || idade > max)) return false
      }
      return true
    })
  }, [filhos, sexoFilter, tamanhoFilter, idadeMin, idadeMax])

  const filhosPorCliente = useMemo(() => {
    if (clienteId || !filteredFilhos) return {}
    return filteredFilhos.reduce((acc: Record<string, any[]>, f: any) => {
      const cId = f.cliente_id || "sem-cliente"
      acc[cId] = acc[cId] || []
      acc[cId].push(f)
      return acc
    }, {})
  }, [filteredFilhos, clienteId])

  const openNewDialog = () => {
    setEditingFilho(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (filho: any) => {
    setEditingFilho(filho)
    setForm({
      nome: filho.nome || "",
      data_nascimento: filho.data_nascimento || "",
      sexo: filho.sexo || "",
      tamanho_roupa: filho.tamanho_roupa || "2",
      tamanho_calcado: filho.tamanho_calcado || "",
      preferencia_estilo: "",
      cores_preferidas: "",
      personagens_preferidos: "",
      observacoes: filho.observacoes || "",
      status: "ativo"
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (filho: any) => {
    setDeletingFilho(filho)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      return toast({ variant: "destructive", title: "Nome obrigatório", description: "Informe o nome da criança." })
    }

    const targetClientId = clienteId || editingFilho?.cliente_id
    if (!targetClientId) {
      return toast({ variant: "destructive", title: "Erro", description: "Esta criança deve estar vinculada a um cliente." })
    }

    setIsSaving(true)
    try {
      const payload = {
        customerId: targetClientId,
        name: form.nome,
        birthDate: form.data_nascimento || null,
        gender: form.sexo || null,
        shoeSize: form.tamanho_calcado || null,
        clothingSize: form.tamanho_roupa || null,
        notes: form.observacoes || null,
      }

      let res
      if (editingFilho) {
        res = await updateChild(editingFilho.id, payload)
      } else {
        res = await createChild(payload)
      }

      if (res.success) {
        toast({ title: editingFilho ? "Filho atualizado!" : "Filho cadastrado!", description: "Dados persistidos no Supabase." })
        await loadData()
        setIsDialogOpen(false)
      } else {
        toast({ variant: "destructive", title: "Erro ao salvar", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingFilho) return
    try {
      const res = await deleteChild(deletingFilho.id)
      if (res.success) {
        toast({ title: "Filho removido", description: "O registro foi excluído do Supabase." })
        await loadData()
      } else {
        toast({ variant: "destructive", title: "Erro ao excluir", description: res.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setDeletingFilho(null)
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
        <div className="flex items-center gap-3">
          {clienteId && (
            <Button variant="ghost" size="icon" onClick={() => router.push("/crm/clientes")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
              <Baby className="h-8 w-8 text-indigo-600" /> Filhos & Público Vendas
            </h1>
            {clienteId ? (
              <p className="text-muted-foreground text-sm">Crianças vinculadas a <span className="font-semibold text-slate-800">{decodeURIComponent(clienteNome)}</span></p>
            ) : (
              <p className="text-muted-foreground text-sm">Controle geral de faixa etária, marcas e preferências infantis para fidelização.</p>
            )}
          </div>
        </div>
        {clienteId && can('CLIENTES', 'UPDATE') && (
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" onClick={openNewDialog}>
            <Plus className="h-4 w-4" /> Cadastrar Filho
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end bg-white p-4 border rounded-xl shadow-sm">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Sexo</Label>
          <Select value={sexoFilter} onValueChange={(value) => setSexoFilter(value)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="M">Menino</SelectItem>
              <SelectItem value="F">Menina</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Tamanho de Roupa</Label>
          <Select value={tamanhoFilter} onValueChange={(value) => setTamanhoFilter(value)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tamanhos</SelectItem>
              {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Idade Mínima (Anos)</Label>
          <Input
            type="number"
            min={0}
            value={idadeMin}
            onChange={(e) => setIdadeMin(e.target.value)}
            placeholder="0"
            className="h-10 bg-slate-50/50"
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Idade Máxima (Anos)</Label>
          <Input
            type="number"
            min={0}
            value={idadeMax}
            onChange={(e) => setIdadeMax(e.target.value)}
            placeholder="16"
            className="h-10 bg-slate-50/50"
          />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-muted-foreground text-xs">Carregando lista de crianças...</p>
        </div>
      ) : !filteredFilhos || filteredFilhos.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-slate-50/40 text-muted-foreground text-xs">
          Nenhuma criança localizada para os filtros selecionados.
        </div>
      ) : clienteId ? (
        /* View single customer children */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFilhos.map((filho) => {
            const dataNasc = filho.data_nascimento
            return (
              <Card key={filho.id} className="border border-slate-100 hover:border-indigo-500/30 hover:shadow-md transition-all bg-white group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-lg ${filho.sexo === "F" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}`}>
                        {filho.nome?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">{filho.nome}</p>
                        {dataNasc && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Cake className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {new Date(dataNasc + "T12:00:00").toLocaleDateString("pt-BR")} · {calcIdade(dataNasc)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {can('CLIENTES', 'UPDATE') && (
                          <DropdownMenuItem className="cursor-pointer" onClick={() => openEditDialog(filho)}>
                            <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar
                          </DropdownMenuItem>
                        )}
                        {can('CLIENTES', 'DELETE') && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-rose-600 cursor-pointer" onClick={() => openDeleteDialog(filho)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Arquivar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-1.5 flex-wrap mt-4">
                    <Badge variant="outline" className={`text-[9px] h-5 ${filho.sexo === "M" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-pink-50 text-pink-700 border-pink-200"}`}>
                      {filho.sexo === "M" ? "Menino" : "Menina"}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] h-5 bg-slate-50 text-slate-600">
                      Roupas: {filho.tamanho_roupa || "2"}
                    </Badge>
                    {filho.tamanho_calcado && (
                      <Badge variant="outline" className="text-[9px] h-5 bg-indigo-50 text-indigo-700 border-indigo-100">
                        Calçado: {filho.tamanho_calcado}
                      </Badge>
                    )}
                  </div>

                  {filho.observacoes && (
                    <p className="text-[11px] text-muted-foreground italic mt-3 line-clamp-2">Obs: {filho.observacoes}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* General system children view grouped by client */
        <div className="space-y-6">
          {Object.entries(filhosPorCliente).map(([cId, filhosCliente]) => (
            <div key={cId} className="space-y-3">
              <div className="rounded-xl border bg-slate-50/50 p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-700">{clientesMap[cId] || "Comprador Desconhecido"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{filhosCliente.length} filho(s) cadastrado(s)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filhosCliente.map((filho) => {
                  const dataNasc = filho.data_nascimento
                  return (
                    <Card key={filho.id} className="border border-slate-100 hover:border-indigo-500/30 hover:shadow-md transition-all bg-white group">
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${filho.sexo === "F" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}`}>
                              {filho.nome?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{filho.nome}</p>
                              {dataNasc && (
                                <p className="text-[9px] text-slate-400 mt-0.5">{calcIdade(dataNasc)}</p>
                              )}
                            </div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {can('CLIENTES', 'UPDATE') && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => openEditDialog(filho)}>
                                  <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar
                                </DropdownMenuItem>
                              )}
                              {can('CLIENTES', 'DELETE') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-rose-600 cursor-pointer" onClick={() => openDeleteDialog(filho)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Arquivar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIALOG ADD/EDIT */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">{editingFilho ? "Editar Informações do Filho" : "Cadastrar Novo Filho"}</DialogTitle>
            <DialogDescription>
              Fidelize com campanhas baseadas na idade, tamanho ou personagens favoritos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="fnome">Nome Completo *</Label>
              <Input id="fnome" placeholder="Ex: Felipe Naiff Junior" {...field("nome")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="fnasc">Data de Nascimento</Label>
                <Input id="fnasc" type="date" value={form.data_nascimento} onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))} />
              </div>
              
              <div className="space-y-1">
                <Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={v => setForm(p => ({ ...p, sexo: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Menino</SelectItem>
                    <SelectItem value="F">Menina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tamanho de Roupa</Label>
                <Select value={form.tamanho_roupa} onValueChange={v => setForm(p => ({ ...p, tamanho_roupa: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fcalcado">Tamanho de Calçado</Label>
                <Input id="fcalcado" placeholder="Ex: 24" {...field("tamanho_calcado")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fobs">Observações / Alergias</Label>
              <Textarea id="fobs" placeholder="Preferência por marcas específicas, alergias a tecido sintético..." {...field("observacoes")} />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFilho ? "Salvar Alterações" : "Adicionar Filho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-slate-800">Arquivar Criança</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja arquivar e inativar o registro deste filho? A informação deixará de constar nas segmentações ativas do CRM Kids.
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

export default function FilhosPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-muted-foreground text-xs">Aguardando componentes...</p>
      </div>
    }>
      <FilhosPageContent />
    </Suspense>
  )
}
