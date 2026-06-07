"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, ShieldAlert } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createSellerAction, updateSellerAction, deleteSellerAction } from "@/lib/sellers/sellers-actions"

type SellerData = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  cpf: string | null;
  email: string | null;
  status: string;
  commissionRate: number;
  goal?: number;
  notes: string | null;
}

export function VendedoresClient({ initialData }: { initialData: SellerData[] }) {
  const [sellers, setSellers] = useState(initialData)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSeller, setEditingSeller] = useState<SellerData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    email: "",
    phone: "",
    cpf: "",
    commissionRate: 0,
    status: "ACTIVE",
    goal: undefined as number | undefined,
    notes: ""
  })

  const resetForm = () => {
    setFormData({
      name: "",
      nickname: "",
      email: "",
      phone: "",
      cpf: "",
      commissionRate: 0,
      status: "ACTIVE",
      goal: undefined,
      notes: ""
    })
    setEditingSeller(null)
  }

  const handleOpenDialog = (seller?: SellerData) => {
    if (seller) {
      setEditingSeller(seller)
      setFormData({
        name: seller.name,
        nickname: seller.nickname || "",
        email: seller.email || "",
        phone: seller.phone || "",
        cpf: seller.cpf || "",
        commissionRate: seller.commissionRate || 0,
        status: seller.status,
        goal: seller.goal || undefined,
        notes: seller.notes || ""
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (editingSeller) {
        const res = await updateSellerAction({
          id: editingSeller.id,
          ...formData
        })
        if (res.error) throw new Error(res.error)
        
        toast({ title: "Sucesso", description: "Vendedor atualizado" })
        // Update local state without waiting for full page reload for speed
        if (res.seller) {
          setSellers(sellers.map(s => s.id === res.seller.id ? { ...res.seller, commissionRate: Number(res.seller.commissionRate), goal: res.seller.goal ? Number(res.seller.goal) : undefined } : s))
        }
      } else {
        const res = await createSellerAction(formData)
        if (res.error) throw new Error(res.error)
        
        toast({ title: "Sucesso", description: "Vendedor criado" })
        if (res.seller) {
          setSellers([...sellers, { ...res.seller, commissionRate: Number(res.seller.commissionRate), goal: res.seller.goal ? Number(res.seller.goal) : undefined }])
        }
      }
      setIsDialogOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja inativar/remover este vendedor?")) return;
    
    setIsLoading(true)
    try {
      const res = await deleteSellerAction(id)
      if (res.error) throw new Error(res.error)
      toast({ title: "Sucesso", description: "Vendedor removido/inativado" })
      setSellers(sellers.filter(s => s.id !== id))
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input placeholder="Buscar vendedores..." className="max-w-sm" />
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Novo Vendedor
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Apelido</TableHead>
              <TableHead>Comissão (%)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  Nenhum vendedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sellers.map((seller) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium">{seller.name}</TableCell>
                  <TableCell>{seller.nickname || "-"}</TableCell>
                  <TableCell>{seller.commissionRate}%</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${seller.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {seller.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(seller)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(seller.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSeller ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Apelido</Label>
              <Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>CPF</Label>
                <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Comissão Padrão (%)</Label>
                <Input type="number" step="0.01" min="0" value={formData.commissionRate} onChange={e => setFormData({...formData, commissionRate: Number(e.target.value)})} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <select 
                  className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})}
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Meta Mensal (R$)</Label>
                <Input type="number" step="0.01" min="0" value={formData.goal ?? ""} onChange={e => setFormData({...formData, goal: e.target.value ? Number(e.target.value) : undefined})} />
              </div>
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Input value={formData.notes ?? ""} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
