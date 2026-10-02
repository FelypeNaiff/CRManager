"use client"

import React, { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Baby, Plus, Loader2 } from "lucide-react"
import { calcIdade } from "../../utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createChild } from "@/lib/crm/actions"
import { toast } from "@/hooks/use-toast"

interface CustomerChildrenTabProps {
  customer: any
  filhos: any[]
  onUpdate: () => void
}

export function CustomerChildrenTab({ customer, filhos, onUpdate }: CustomerChildrenTabProps) {
  const [isQuickAddFilhoOpen, setIsQuickAddFilhoOpen] = useState(false)
  const [isSavingQuickFilho, setIsSavingQuickFilho] = useState(false)
  const [quickFilhoForm, setQuickFilhoForm] = useState({
    nome: "", data_nascimento: "", sexo: "", tamanho_roupa: "2", tamanho_calcado: "", observacoes: ""
  })

  const handleSaveQuickFilho = async () => {
    if (!quickFilhoForm.nome.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Nome é obrigatório." })
    }
    setIsSavingQuickFilho(true)
    try {
      const payload = {
        customerId: customer.id,
        name: quickFilhoForm.nome,
        birthDate: quickFilhoForm.data_nascimento || null,
        gender: quickFilhoForm.sexo || null,
        shoeSize: quickFilhoForm.tamanho_calcado || null,
        clothingSize: quickFilhoForm.tamanho_roupa || null,
        notes: quickFilhoForm.observacoes || null,
      }
      const res = await createChild(payload)
      if (res.success) {
        toast({ title: "Filho cadastrado!", description: "Dados gravados com sucesso." })
        setIsQuickAddFilhoOpen(false)
        setQuickFilhoForm({ nome: "", data_nascimento: "", sexo: "", tamanho_roupa: "2", tamanho_calcado: "", observacoes: "" })
        onUpdate()
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." })
    } finally {
      setIsSavingQuickFilho(false)
    }
  }

  return (
    <div className="space-y-4 pt-4 text-xs">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 text-sm">Crianças Associadas</h3>
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 h-8 text-[11px]" onClick={() => setIsQuickAddFilhoOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Adicionar Criança
        </Button>
      </div>

      {filhos.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-slate-50/40 text-muted-foreground">
          Sem crianças vinculadas a este responsável.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filhos.map((filho, idx) => (
            <Card key={idx} className="border border-slate-100 shadow-sm bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${filho.sexo === "F" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}`}>
                    {filho.nome?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{filho.nome}</p>
                    {filho.data_nascimento && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(filho.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")} — {calcIdade(filho.data_nascimento)}
                      </p>
                    )}
                  </div>
                </div>
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
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isQuickAddFilhoOpen} onOpenChange={setIsQuickAddFilhoOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Vincular Novo Filho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Nome Completo</Label>
              <Input placeholder="Ex: Arthur" value={quickFilhoForm.nome} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nascimento</Label>
                <Input type="date" value={quickFilhoForm.data_nascimento} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, data_nascimento: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Sexo</Label>
                <select className="w-full border rounded h-9 px-2 bg-white" value={quickFilhoForm.sexo} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, sexo: e.target.value })}>
                  <option value="">Selecionar</option>
                  <option value="M">Menino</option>
                  <option value="F">Menina</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tamanho Roupa</Label>
                <select className="w-full border rounded h-9 px-2 bg-white" value={quickFilhoForm.tamanho_roupa} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, tamanho_roupa: e.target.value })}>
                  {["RN", "P", "M", "G", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Calçado</Label>
                <Input placeholder="Ex: 24" value={quickFilhoForm.tamanho_calcado} onChange={e => setQuickFilhoForm({ ...quickFilhoForm, tamanho_calcado: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsQuickAddFilhoOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleSaveQuickFilho} disabled={isSavingQuickFilho}>
              {isSavingQuickFilho && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
