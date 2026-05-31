"use client"

import { useState } from "react"
import { FolderTree, Plus, Search, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemosupabase-mocks } from "@/supabase-mocks"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "@/supabase-mocks/firestore"
import { toast } from "@/hooks/use-toast"

export default function GruposProdutosPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: "", descricao: "" })

  const gruposQuery = useMemosupabase-mocks(() => {
    return db ? query(collection(db, "gruposProdutos"), orderBy("nome", "asc")) : null
  }, [db])
  const { data: grupos } = useCollection(gruposQuery)

  const filteredGrupos = grupos?.filter(g => 
    g.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const openNewDialog = () => {
    setEditingId(null)
    setForm({ nome: "", descricao: "" })
    setIsDialogOpen(true)
  }

  const openEditDialog = (grupo: any) => {
    setEditingId(grupo.id)
    setForm({ nome: grupo.nome, descricao: grupo.descricao || "" })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome é obrigatório." })
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateDoc(doc(db, "gruposProdutos", editingId), {
          nome: form.nome,
          descricao: form.descricao,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Grupo atualizado com sucesso." })
      } else {
        await addDoc(collection(db, "gruposProdutos"), {
          nome: form.nome,
          descricao: form.descricao,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Grupo criado com sucesso." })
      }
      setIsDialogOpen(false)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar grupo." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este grupo?")) {
      try {
        await deleteDoc(doc(db, "gruposProdutos", id))
        toast({ title: "Grupo excluído com sucesso." })
      } catch (err) {
        toast({ variant: "destructive", title: "Erro ao excluir grupo." })
      }
    }
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Estoque</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">Grupos de Produtos</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-sidebar-foreground" /> Grupos e Categorias
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-1">
          <Button onClick={openNewDialog} className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]">
            <Plus className="h-3.5 w-3.5" /> Adicionar Grupo
          </Button>
        </div>
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            className="h-8 rounded-sm w-full sm:w-[300px] border-gray-300 focus-visible:ring-0 focus-visible:border-primary text-[13px]"
            placeholder="Pesquisar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {filteredGrupos.length === 0 ? (
        <div className="text-center py-20 border rounded-sm bg-gray-50">
          <p className="text-muted-foreground">Nenhum grupo cadastrado.</p>
        </div>
      ) : (
        <div className="border rounded-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left p-3 font-semibold">Nome</th>
                <th className="text-left p-3 font-semibold">Descrição</th>
                <th className="text-center p-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredGrupos.map(grupo => (
                <tr key={grupo.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{grupo.nome}</td>
                  <td className="p-3 text-gray-600">{grupo.descricao || "-"}</td>
                  <td className="p-3 flex items-center justify-center gap-1">
                    <button 
                      onClick={() => openEditDialog(grupo)}
                      className="btn-erp-action-blue"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(grupo.id)}
                      className="btn-erp-action-red"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog de Criação/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Grupo" : "Novo Grupo de Produtos"}</DialogTitle>
            <DialogDescription>Preencha as informações do grupo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Nome *</label>
              <Input 
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Roupas, Calçados, Acessórios"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Descrição</label>
              <Input 
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
