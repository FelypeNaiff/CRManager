"use client"

import { useState } from "react"
import { Layers, Plus, Search, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase } from "@/lib/legacy-stubs"
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "@/lib/legacy-firestore-stubs"
import { toast } from "@/hooks/use-toast"

export default function GradesVariacoesPage() {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: "", valores: "" })

  const gradesQuery = useMemoFirebase(() => {
    return db ? query(collection(db, "gradesVariacoes"), orderBy("nome", "asc")) : null
  }, [db])
  const { data: grades } = useCollection(gradesQuery)

  const filteredGrades = grades?.filter(g => 
    g.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const openNewDialog = () => {
    setEditingId(null)
    setForm({ nome: "", valores: "" })
    setIsDialogOpen(true)
  }

  const openEditDialog = (grade: any) => {
    setEditingId(grade.id)
    setForm({ 
      nome: grade.nome, 
      valores: grade.valores?.join(", ") || "" 
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.valores.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Variação é obrigatória." })
      return
    }

    const valoresArray = form.valores.split(",").map(v => v.trim()).filter(Boolean)
    const nomeGerado = valoresArray.join("/") || "Variação"

    setIsSaving(true)
    try {
      if (editingId) {
        await updateDoc(doc(db, "gradesVariacoes", editingId), {
          nome: nomeGerado,
          valores: valoresArray,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Grade atualizada com sucesso." })
      } else {
        await addDoc(collection(db, "gradesVariacoes"), {
          nome: form.nome,
          valores: valoresArray,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Grade criada com sucesso." })
      }
      setIsDialogOpen(false)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar grade." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta grade?")) {
      try {
        await deleteDoc(doc(db, "gradesVariacoes", id))
        toast({ title: "Grade excluída com sucesso." })
      } catch (err) {
        toast({ variant: "destructive", title: "Erro ao excluir grade." })
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
        <span className="font-semibold text-foreground">Grades e Variações</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Layers className="h-5 w-5 text-sidebar-foreground" /> Grades e Variações
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-1">
          <Button onClick={openNewDialog} className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]">
            <Plus className="h-3.5 w-3.5" /> Adicionar Grade
          </Button>
        </div>
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            className="h-8 rounded-sm w-full sm:w-[300px] border-gray-300 focus-visible:ring-0 focus-visible:border-primary text-[13px]"
            placeholder="Pesquisar grades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {filteredGrades.length === 0 ? (
        <div className="text-center py-20 border rounded-sm bg-gray-50">
          <p className="text-muted-foreground">Nenhuma grade cadastrada (ex: Tamanhos P/M/G, Cores).</p>
        </div>
      ) : (
        <div className="border rounded-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left p-3 font-semibold">Nome</th>
                <th className="text-left p-3 font-semibold">Valores</th>
                <th className="text-center p-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredGrades.map(grade => (
                <tr key={grade.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{grade.nome}</td>
                  <td className="p-3 text-gray-600">{grade.valores?.join(", ") || "-"}</td>
                  <td className="p-3 flex items-center justify-center gap-1">
                    <button 
                      onClick={() => openEditDialog(grade)}
                      className="btn-erp-action-blue"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(grade.id)}
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
            <DialogTitle>{editingId ? "Editar Grade" : "Nova Grade de Variação"}</DialogTitle>
            <DialogDescription>Preencha as informações da grade</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">VARIAÇÃO</label>
              <Input 
                value={form.valores}
                onChange={(e) => setForm({ ...form, valores: e.target.value })}
                placeholder="Ex: P, M, G, GG ou Vermelho, Azul, Verde"
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
