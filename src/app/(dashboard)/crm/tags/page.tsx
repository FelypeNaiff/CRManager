"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Tags, Plus, Pencil, Trash2, Loader2, Info, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getTags, createTag, deleteTag, getCustomers } from "@/lib/crm/actions"

const emptyForm = {
  nome: "",
  cor: "#4f46e5",
  status: "ativo" as "ativo" | "inativo" | "arquivado"
}

export default function TagsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<any>(null)
  const [deletingTag, setDeletingTag] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  
  const [tags, setTags] = useState<any[] | null>(null)
  const [customers, setCustomers] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [tagsRes, custRes] = await Promise.all([getTags(), getCustomers()])
      
      if (tagsRes.success && tagsRes.data) {
        setTags(tagsRes.data)
      } else {
        setError(tagsRes.error || "Erro ao carregar tags.")
      }

      if (custRes.success && custRes.data) {
        setCustomers(custRes.data)
      }
    } catch (e: any) {
      console.error(e)
      setError("Erro ao carregar dados do CRM.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const tagCounts = useMemo(() => {
    if (!customers || !tags) return {}
    const counts: Record<string, number> = {}
    
    // Set 0 for all active tags
    tags.forEach(t => { counts[t.name] = 0 })
    
    // Count usage
    customers.forEach((c: any) => {
      if (c.tagRelations && Array.isArray(c.tagRelations)) {
        c.tagRelations.forEach((rel: any) => {
          if (rel.tag) {
            counts[rel.tag.name] = (counts[rel.tag.name] || 0) + 1
          }
        })
      }
    })
    return counts
  }, [customers, tags])

  const openNewDialog = () => {
    setEditingTag(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (tag: any) => {
    setEditingTag(tag)
    setForm({
      nome: tag.name || "",
      cor: tag.color || "#4f46e5",
      status: "ativo"
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (tag: any) => {
    setDeletingTag(tag)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      return toast({ variant: "destructive", title: "Nome obrigatório" })
    }

    setIsSaving(true)
    try {
      const name = form.nome.toUpperCase().replace(/\s+/g, "_")
      const color = form.cor || "#4f46e5"

      const res = await createTag(name, color)

      if (res.success) {
        toast({ title: editingTag ? "Tag atualizada!" : "Tag criada!", description: "Dados persistidos no Supabase." })
        await loadData()
        setIsDialogOpen(false)
      } else {
        toast({ variant: "destructive", title: "Erro ao salvar tag", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar tag" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTag) return
    try {
      const res = await deleteTag(deletingTag.id)
      if (res.success) {
        toast({ title: "Tag removida", description: "O registro foi excluído do Supabase." })
        await loadData()
      } else {
        toast({ variant: "destructive", title: "Erro ao remover tag", description: res.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    } finally {
      setDeletingTag(null)
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Tags className="h-8 w-8 text-indigo-600" /> Biblioteca de Tags
          </h1>
          <p className="text-muted-foreground text-sm">Crie e configure etiquetas de segmentação para automatizar disparos de WhatsApp.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" onClick={openNewDialog}>
          <Plus className="h-4 w-4" /> Nova Tag
        </Button>
      </div>

      {/* Info card */}
      <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
        <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-950/80 leading-relaxed">
          As tags no CRM Trupe Kids são utilizadas para segmentar clientes por padrões de compras, faixa etária dos filhos, ou datas comemorativas. 
          Use nomes curtos e em caixa alta. Ex: <strong>CLIENTE_VIP</strong>, <strong>MÃE_DE_MENINO</strong>.
        </p>
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
          <p className="text-muted-foreground text-xs">Carregando tags de segmentação...</p>
        </div>
      ) : !tags || tags.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-slate-50/40 text-muted-foreground text-xs">
          Nenhuma tag cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tags.map((tag) => (
            <Card key={tag.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-all bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: tag.color || "#4f46e5" }} />
              <CardHeader className="p-4 pl-6 pb-2 flex flex-row items-center justify-between space-y-0">
                <Badge style={{ backgroundColor: tag.color || "#4f46e5" }} className="text-white text-xs border-0 py-0.5 px-2.5">
                  {tag.name}
                </Badge>
                
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => openEditDialog(tag)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-400 hover:text-rose-600" onClick={() => openDeleteDialog(tag)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pl-6 pt-0 text-xs text-slate-500">
                <div className="flex justify-between items-center mt-2">
                  <span>Clientes Vinculados:</span>
                  <strong className="text-slate-800 text-sm">{tagCounts[tag.name] || 0}</strong>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DIALOG ADD/EDIT */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">{editingTag ? "Editar Tag" : "Nova Tag de Segmentação"}</DialogTitle>
            <DialogDescription>
              Crie uma tag para segmentar sua base de clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="fnome">Nome da Tag (Será convertida em MAIÚSCULAS) *</Label>
              <Input 
                id="fnome" 
                placeholder="Ex: MAE_DE_GEMEOS" 
                value={form.nome} 
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} 
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fcor">Cor de Exibição (Hex)</Label>
              <div className="flex items-center gap-3">
                <Input 
                  id="fcor" 
                  type="color" 
                  className="w-12 h-10 p-1 border rounded-lg cursor-pointer" 
                  value={form.cor} 
                  onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                />
                <Input 
                  type="text" 
                  placeholder="#4f46e5" 
                  className="flex-1" 
                  value={form.cor} 
                  onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTag ? "Salvar Alterações" : "Criar Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-slate-800">Inativar Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover esta tag? Ela deixará de constar nas opções de novos vínculos de segmentação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500" onClick={handleDelete}>
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
