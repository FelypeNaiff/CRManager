"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { safeInteger } from "@/lib/utils/form-normalizer"
import {
  createCustomer,
  updateCustomer,
  createChild,
  updateChild,
  deleteChild
} from "@/lib/crm/actions"

interface CustomerDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingCustomer: any
  isCadastroRapido: boolean
  onSuccess: () => void
}

const emptyForm = {
  nome: "",
  cpf: "",
  whatsapp_principal: "",
  whatsapp_secundario: "",
  instagram: "",
  email: "",
  data_nascimento: "",
  observacoes: "",
  status: "ativo",
  vip: false,
  aceita_marketing: true
}

export function CustomerDialog({
  isOpen,
  onOpenChange,
  editingCustomer,
  isCadastroRapido,
  onSuccess
}: CustomerDialogProps) {
  const [form, setForm] = useState(emptyForm)
  const [filhos, setFilhos] = useState<any[]>([])
  const [deletedFilhos, setDeletedFilhos] = useState<string[]>([])
  const [rapidoFilhos, setRapidoFilhos] = useState([{ nome: "", data_nascimento: "" }])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingCustomer) {
        setForm({
          nome: editingCustomer.nome || "",
          cpf: editingCustomer.cpf || "",
          whatsapp_principal: editingCustomer.whatsapp_principal || "",
          whatsapp_secundario: editingCustomer.whatsapp_secundario || "",
          instagram: editingCustomer.instagram || "",
          email: editingCustomer.email || "",
          data_nascimento: editingCustomer.data_nascimento || "",
          observacoes: editingCustomer.observacoes || "",
          status: editingCustomer.status || "ativo",
          vip: editingCustomer.vip || false,
          aceita_marketing: editingCustomer.aceita_marketing ?? true
        })
        if (editingCustomer.children) {
          setFilhos(editingCustomer.children.map((f: any) => ({
            id: f.id,
            nome: f.name,
            data_nascimento: f.birthDate ? new Date(f.birthDate).toISOString().substring(0, 10) : "",
            sexo: f.gender || "",
            tamanho_roupa: f.clothingSize || "2",
            tamanho_calcado: f.shoeSize || "",
            observacoes: f.notes || "",
            status: "ativo"
          })))
        } else {
          setFilhos([])
        }
      } else {
        setForm(emptyForm)
        setFilhos([])
        setRapidoFilhos([{ nome: "", data_nascimento: "" }])
      }
      setDeletedFilhos([])
    }
  }, [isOpen, editingCustomer])

  const handleAddFilho = () => {
    setFilhos([...filhos, { nome: "", data_nascimento: "", sexo: "", tamanho_roupa: "2", tamanho_calcado: "", observacoes: "", status: "ativo" }])
  }

  const handleFilhoChange = (index: number, field: string, value: any) => {
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
    if (!form.nome.trim()) return toast({ variant: "destructive", title: "Erro", description: "Nome é obrigatório." })
    if (!form.whatsapp_principal.trim()) return toast({ variant: "destructive", title: "Erro", description: "WhatsApp é obrigatório." })

    const cleanWhatsapp = form.whatsapp_principal.replace(/\\D/g, "")
    setIsSaving(true)

    try {
      let bDay: number | null = null
      let bMonth: number | null = null
      let bYear: number | null = null

      if (form.data_nascimento) {
        const parts = form.data_nascimento.split("-")
        if (parts.length === 3) {
          bYear = safeInteger(parts[0])
          bMonth = safeInteger(parts[1])
          bDay = safeInteger(parts[2])
        }
      }

      const cleanCpf = form.cpf ? form.cpf.replace(/\\D/g, "") : null;
      const finalCpf = cleanCpf && cleanCpf.length === 11 ? form.cpf : null;

      const clientPayload = {
        name: form.nome,
        email: form.email || null,
        phone: cleanWhatsapp,
        cpf: finalCpf,
        birthDay: bDay,
        birthMonth: bMonth,
        birthYear: bYear,
        instagram: form.instagram || null,
        notes: form.observacoes || null,
        status: form.status as "ativo" | "inativo" | "arquivado",
      }

      let savedClient: any = null
      if (editingCustomer) {
        const res = await updateCustomer(editingCustomer.id, clientPayload)
        if (res.success) {
          savedClient = res.data
          toast({ title: "Cliente atualizado!", description: "Dados gravados com sucesso." })
        } else {
          setIsSaving(false)
          return toast({ variant: "destructive", title: "Erro ao atualizar", description: res.error })
        }
      } else {
        const res = await createCustomer(clientPayload)
        if (res.success) {
          savedClient = res.data
          toast({ title: "Cliente criado!", description: "Cadastro realizado com carteira inicial preparada." })
        } else {
          setIsSaving(false)
          return toast({ variant: "destructive", title: "Erro ao criar cliente", description: res.error })
        }
      }

      const clientId = savedClient.id
      let batchFilhos = [...filhos]

      if (isCadastroRapido) {
        batchFilhos = rapidoFilhos.filter(filho => filho.nome.trim()).map(filho => ({
          nome: filho.nome.trim(),
          data_nascimento: filho.data_nascimento,
          sexo: "M",
          tamanho_roupa: "2",
          tamanho_calcado: "",
          observacoes: "",
          status: "ativo"
        }))
      }

      for (const filho of batchFilhos) {
        if (!filho.nome.trim()) continue
        const childPayload = {
          customerId: clientId,
          name: filho.nome,
          birthDate: filho.data_nascimento || null,
          gender: filho.sexo || null,
          shoeSize: filho.tamanho_calcado || null,
          clothingSize: filho.tamanho_roupa || null,
          notes: filho.observacoes || null
        }

        if (filho.id) {
          await updateChild(filho.id, childPayload)
        } else {
          await createChild(childPayload)
        }
      }

      for (const delId of deletedFilhos) {
        await deleteChild(delId)
      }

      onSuccess()
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            {editingCustomer ? "Editar Ficha de Cliente" : "Cadastrar Novo Cliente Responsável"}
          </DialogTitle>
          <DialogDescription>
            {isCadastroRapido ? "Preencha os campos essenciais para liberar a venda rapidamente." : "Registre os dados completos do comprador e vincule dependentes para segmentação."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cnome">Nome Completo *</Label>
              <Input id="cnome" placeholder="Ex: Felipe Naiff" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ccpf">CPF</Label>
              <Input id="ccpf" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cwhats">WhatsApp Principal *</Label>
              <Input id="cwhats" placeholder="Ex: (11) 99999-9999" value={form.whatsapp_principal} onChange={e => setForm({ ...form, whatsapp_principal: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cwhats2">WhatsApp Secundário</Label>
              <Input id="cwhats2" placeholder="Ex: (11) 99999-9999" value={form.whatsapp_secundario} onChange={e => setForm({ ...form, whatsapp_secundario: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cemail">E-mail</Label>
              <Input id="cemail" type="email" placeholder="cliente@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cnasc">Data de Nascimento</Label>
              <Input id="cnasc" type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
            </div>
          </div>

          {!isCadastroRapido ? (
            <>
              <Separator />
              <h3 className="font-bold text-slate-800 text-sm">Vincular Filhos / Dependentes</h3>
              
              {filhos.length === 0 ? (
                <p className="text-muted-foreground italic">Nenhum filho cadastrado para este responsável.</p>
              ) : (
                <div className="space-y-3">
                  {filhos.map((filho, idx) => (
                    <div key={idx} className="border p-3 rounded-lg bg-slate-50/50 space-y-3 relative">
                      <Button variant="ghost" size="icon" aria-label="Remover dependente" className="h-6 w-6 text-rose-500 absolute top-2 right-2" onClick={() => handleRemoveFilho(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Nome do Filho *</Label>
                          <Input placeholder="Ex: Arthur Naiff" value={filho.nome} onChange={e => handleFilhoChange(idx, "nome", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Nascimento</Label>
                          <Input type="date" value={filho.data_nascimento} onChange={e => handleFilhoChange(idx, "data_nascimento", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>Sexo</Label>
                          <select className="w-full border rounded h-9 px-2 bg-white" value={filho.sexo} onChange={e => handleFilhoChange(idx, "sexo", e.target.value)}>
                            <option value="">Selecionar</option>
                            <option value="M">Menino</option>
                            <option value="F">Menina</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Tam. Roupa</Label>
                          <select className="w-full border rounded h-9 px-2 bg-white" value={filho.tamanho_roupa} onChange={e => handleFilhoChange(idx, "tamanho_roupa", e.target.value)}>
                            {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Calçado</Label>
                          <Input placeholder="Ex: 24" value={filho.tamanho_calcado} onChange={e => handleFilhoChange(idx, "tamanho_calcado", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <Button variant="outline" className="h-9 gap-1 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50" onClick={handleAddFilho}>
                <Plus className="h-4 w-4" /> Adicionar Dependente
              </Button>
            </>
          ) : (
            <div className="bg-indigo-50/30 p-3 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-indigo-950 uppercase text-[10px] tracking-wider">Filhos / Dependentes</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => setRapidoFilhos([...rapidoFilhos, { nome: "", data_nascimento: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar filho
                </Button>
              </div>
              {rapidoFilhos.map((filho, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-md border bg-white p-3">
                  <div className="space-y-1">
                    <Label>Nome do Filho</Label>
                    <Input placeholder="Ex: Lucas" value={filho.nome} onChange={e => setRapidoFilhos(rapidoFilhos.map((item, itemIndex) => itemIndex === index ? { ...item, nome: e.target.value } : item))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" max={new Date().toISOString().slice(0, 10)} value={filho.data_nascimento} onChange={e => setRapidoFilhos(rapidoFilhos.map((item, itemIndex) => itemIndex === index ? { ...item, data_nascimento: e.target.value } : item))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover filho ${index + 1}`} disabled={rapidoFilhos.length === 1} onClick={() => setRapidoFilhos(rapidoFilhos.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />
          
          <div className="space-y-2">
            <Label>Observações de Atendimento</Label>
            <Textarea placeholder="Histórico de alergias, marcas preferidas, restrições..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <div className="flex items-center gap-6 bg-slate-50 p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Switch id="cvip" checked={form.vip === true} onCheckedChange={checked => setForm({ ...form, vip: checked, status: checked ? 'ativo' : 'ativo' })} />
              <Label htmlFor="cvip" className="font-semibold cursor-pointer">Marcar como Cliente VIP</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="cmarketing" checked={form.aceita_marketing} onCheckedChange={checked => setForm({ ...form, aceita_marketing: checked })} />
              <Label htmlFor="cmarketing" className="font-semibold cursor-pointer">Aceita WhatsApp Marketing</Label>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingCustomer ? "Salvar Alterações" : "Concluir Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
