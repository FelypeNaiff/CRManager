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
  Truck,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
  Plus,
  List,
  ChevronDown
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useCollection, useMemoFirebase, useFirestore } from "@/lib/legacy-stubs"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "@/lib/legacy-firestore-stubs"
import { toast } from "@/hooks/use-toast"

const emptyForm = {
  nomeFornecedor: "",
  cnpj: "",
  whatsapp: "",
  telefone: "",
  email: "",
  site: "",
  instagram: "",
  loginSite: "",
  senhaSite: "",
  cep: "",
  cidade: "",
  estado: "",
  endereco: "",
  produtosVende: [] as string[],
  genero: "" as string,
}

export default function FornecedoresPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const db = useFirestore()

  const fornecedoresQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "fornecedores")
  }, [db])

  const { data: fornecedores, isLoading, error } = useCollection(fornecedoresQuery)

  const filteredItems = (fornecedores || []).filter(c =>
    c.nomeFornecedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj?.includes(searchTerm)
  )

  const openNewDialog = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: any) => {
    setEditingItem(item)
    setForm({
      nomeFornecedor: item.nomeFornecedor || "",
      cnpj: item.cnpj || "",
      whatsapp: item.whatsapp || "",
      telefone: item.telefone || "",
      email: item.email || "",
      site: item.site || "",
      instagram: item.instagram || "",
      loginSite: item.loginSite || "",
      senhaSite: item.senhaSite || "",
      cep: item.cep || "",
      cidade: item.cidade || "",
      estado: item.estado || "",
      endereco: item.endereco || "",
      produtosVende: item.produtosVende || [],
      genero: item.genero || "",
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!form.nomeFornecedor.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o Nome do Fornecedor." })
      return
    }
    
    setIsSaving(true)
    try {
      if (editingItem) {
        await updateDoc(doc(db, "fornecedores", editingItem.id), {
          ...form,
          ativo: true,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Fornecedor atualizado!" })
      } else {
        await addDoc(collection(db, "fornecedores"), {
          ...form,
          ativo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Fornecedor cadastrado!" })
      }
      setIsDialogOpen(false)
      setForm(emptyForm)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar o fornecedor." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteDoc(doc(db, "fornecedores", deletingId))
      toast({ title: "Fornecedor excluído" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setDeletingId(null)
      setIsDeleteOpen(false)
    }
  }

  const field = (key: keyof typeof emptyForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Breadcrumb simulado */}
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Estoque</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">Fornecedores</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Truck className="h-5 w-5 text-sidebar-foreground" /> Fornecedores
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-1">
          <Button className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]" onClick={openNewDialog}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
          <Button className="btn-erp-dark gap-1 h-8 rounded-sm px-3 text-[13px]">
            <List className="h-3.5 w-3.5" /> Mais ações <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 rounded-sm w-full sm:w-[300px] border-gray-300 focus-visible:ring-0 focus-visible:border-primary text-[13px]"
            placeholder="Pesquisar..."
          />
          <Button className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm flex-1">
            <h3 className="font-semibold text-base">Erro ao carregar fornecedores</h3>
            <p>{(error as any).message}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando fornecedores...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 border rounded-sm bg-gray-50">
          <p className="text-muted-foreground font-medium">Nenhum fornecedor encontrado.</p>
          <p className="text-muted-foreground text-sm mt-1">Clique em "Adicionar" para cadastrar um novo fornecedor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden group hover:border-primary/50 transition-colors shadow-sm rounded-sm">
              <CardHeader className="p-4 pb-0 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {(item.nomeFornecedor)?.charAt(0)?.toUpperCase() || "F"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1" title={item.nomeFornecedor}>
                      {item.nomeFornecedor}
                    </h3>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{item.cnpj || "Sem CNPJ/CPF"}</div>
                  </div>
                </div>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteDialog(item.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="p-4 space-y-2 mt-2">
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" /> {item.telefone || "-"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" /> <span className="truncate">{item.email || "-"}</span>
                  </div>
                  {(item.cidade || item.estado) && (
                    <div className="flex items-center gap-2 text-muted-foreground mt-2 pt-2 border-t">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{item.cidade}{item.estado ? `, ${item.estado}` : ""}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* INFORMAÇÕES BÁSICAS */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Informações Básicas</h3>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nomeFornecedor">Nome do Fornecedor *</Label>
              <Input id="nomeFornecedor" {...field("nomeFornecedor")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ / CPF</Label>
              <Input id="cnpj" {...field("cnpj")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" {...field("whatsapp")} placeholder="85 99215-7538" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...field("telefone")} placeholder="(11) 9999-9999" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...field("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input id="site" {...field("site")} placeholder="https://example.com.br/" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" {...field("instagram")} placeholder="@usuario" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loginSite">Login do site</Label>
              <Input id="loginSite" {...field("loginSite")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senhaSite">Senha do site</Label>
              <Input id="senhaSite" type="password" {...field("senhaSite")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" {...field("cep")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...field("cidade")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" maxLength={2} {...field("estado")} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" {...field("endereco")} />
            </div>

            {/* PRODUTOS QUE VENDE */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Produtos que vende</h3>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3">
                  {["Normal", "Moda Praia", "Jeans", "Pijamas", "Acessórios", "Calçados"].map((produto) => (
                    <label key={produto} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.produtosVende.includes(produto)}
                        onChange={(e) => {
                          setForm(prev => ({
                            ...prev,
                            produtosVende: e.target.checked
                              ? [...prev.produtosVende, produto]
                              : prev.produtosVende.filter(p => p !== produto)
                          }))
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">{produto}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* GÊNERO */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Gênero</h3>
              <div className="flex flex-wrap gap-3">
                {["Menino", "Menina", "Unissex"].map((genero) => (
                  <label key={genero} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="genero"
                      value={genero}
                      checked={form.genero === genero}
                      onChange={(e) => setForm(prev => ({ ...prev, genero: e.target.value }))}
                      className="h-4 w-4 border-gray-300"
                    />
                    <span className="text-sm">{genero}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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
