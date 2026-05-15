"use client"

import { useState } from "react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, deleteDoc, serverTimestamp, addDoc } from "firebase/firestore"
import { Plus, Users, Search, Filter, Lock, Unlock, Eye, Edit3, Trash2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { usuarioSchema } from "@/types/configuracoes"

import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigDataTable,
  ConfigDataTableHeader,
  ConfigDataTableRow,
  ConfigDataTableHead,
  ConfigDataTableBody,
  ConfigDataTableCell,
  ConfigStatusBadge,
  ConfigInputField,
  ConfigSelectField,
  ConfigTextareaField,
  ConfigSwitchField
} from "@/components/configuracoes/config-ui"

const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  cargo: "",
  grupo_id: "",
  status: "ATIVO" as "ATIVO" | "INATIVO" | "BLOQUEADO",
  permitir_acesso: true,
  observacoes: ""
}

export default function UsuariosConfigPage() {
  const [searchTerm, setSearchTerm] = useState("")
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()
  
  // Queries
  const usuariosQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.empresaId) return null
    return query(collection(db, "usuarios"), where("empresa_id", "==", activeProfile.empresaId))
  }, [db, activeProfile?.empresaId])

  const gruposQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.empresaId) return null
    return query(collection(db, "grupos_usuarios"), where("empresa_id", "==", activeProfile.empresaId))
  }, [db, activeProfile?.empresaId])

  const { data: usuariosData, isLoading } = useCollection(usuariosQuery)
  const { data: gruposData } = useCollection(gruposQuery)

  const usuarios = usuariosData ?? []
  const grupos = gruposData ?? []

  const filteredUsuarios = usuarios.filter((u: any) => {
    const term = searchTerm.toLowerCase()
    return (
      (u.nome && u.nome.toLowerCase().includes(term)) || 
      (u.email && u.email.toLowerCase().includes(term))
    )
  })

  const getGrupoNome = (grupoId: string) => {
    const grupo = grupos.find((g: any) => g.id === grupoId)
    return grupo ? grupo.nome : "Sem grupo"
  }

  const openNewUser = () => {
    setEditingId(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  const openEditUser = (user: any) => {
    setEditingId(user.id)
    setForm({
      nome: user.nome || "",
      email: user.email || "",
      telefone: user.telefone || "",
      cargo: user.cargo || "",
      grupo_id: user.grupo_id || "",
      status: user.status || "ATIVO",
      permitir_acesso: user.permitir_acesso !== false,
      observacoes: user.observacoes || ""
    })
    setIsModalOpen(true)
  }

  const handleUpdateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const isUserOnlyAdmin = (userId: string) => {
    // Identificar todos os grupos que são "is_admin"
    const adminGroupsIds = grupos.filter((g: any) => g.is_admin === true).map((g: any) => g.id)
    if (adminGroupsIds.length === 0) return false // Se não há conceito de admin groups, não tem como bloquear

    // Pessoas ativas nestes grupos
    const adminsAtivos = usuarios.filter((u: any) => 
      adminGroupsIds.includes(u.grupo_id) && u.status === "ATIVO"
    )

    // Se só tem 1 e é o ID alvo
    if (adminsAtivos.length === 1 && adminsAtivos[0].id === userId) {
      return true
    }
    return false
  }

  const handleSave = async () => {
    if (!db || !activeProfile) return

    // Validação de Duplicidade de E-mail
    const emailExists = usuarios.some((u: any) => 
      u.email.toLowerCase() === form.email.toLowerCase() && u.id !== editingId
    )
    if (emailExists) {
      return toast({ variant: "destructive", title: "E-mail em uso", description: "Já existe um usuário com este e-mail na empresa." })
    }

    const payloadToValidate = {
      ...form,
      empresa_id: activeProfile.empresaId,
      atualizado_por: activeProfile.id
    }

    const validation = usuarioSchema.safeParse(payloadToValidate)
    if (!validation.success) {
      return toast({ variant: "destructive", title: "Erro", description: validation.error.errors[0].message })
    }

    // Regra de segurança: não remover admin power de si próprio se for o único
    if (editingId && isUserOnlyAdmin(editingId)) {
      const adminGroupsIds = grupos.filter((g: any) => g.is_admin === true).map((g: any) => g.id)
      if (!adminGroupsIds.includes(form.grupo_id) || form.status !== "ATIVO" || !form.permitir_acesso) {
        return toast({ variant: "destructive", title: "Ação não permitida", description: "Este é o único administrador ativo do sistema. Crie outro admin primeiro." })
      }
    }

    setIsSaving(true)
    try {
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
      }

      let logAcao = "UPDATE"
      if (editingId) {
        await updateDoc(doc(db, "usuarios", editingId), dataToSave)
      } else {
        logAcao = "CREATE"
        await addDoc(collection(db, "usuarios"), {
          ...dataToSave,
          criado_em: serverTimestamp()
        })
      }

      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: logAcao,
        modulo: "Usuários",
        registro_id: form.email,
        data_hora: serverTimestamp(),
      })

      toast({ title: editingId ? "Usuário atualizado" : "Usuário criado com sucesso!" })
      setIsModalOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar usuário" })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleBlockStatus = async (user: any) => {
    if (!db || !activeProfile) return
    const novoStatus = user.status === "BLOQUEADO" ? "ATIVO" : "BLOQUEADO"
    
    if (novoStatus === "BLOQUEADO" && isUserOnlyAdmin(user.id)) {
      return toast({ variant: "destructive", title: "Ação bloqueada", description: "Não é possível bloquear o único administrador ativo do sistema." })
    }

    const confirmMsg = novoStatus === "BLOQUEADO" 
      ? `Bloquear acesso de ${user.nome}?` 
      : `Desbloquear acesso de ${user.nome}?`
    
    if (!confirm(confirmMsg)) return

    try {
      await updateDoc(doc(db, "usuarios", user.id), {
        status: novoStatus,
        atualizado_em: serverTimestamp(),
        atualizado_por: activeProfile.id
      })
      
      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Usuários",
        registro_id: user.id,
        detalhes: `Status alterado para ${novoStatus}`,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Status atualizado com sucesso!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    }
  }

  const handleDelete = async (user: any) => {
    if (!db || !activeProfile) return

    if (isUserOnlyAdmin(user.id)) {
      return toast({ variant: "destructive", title: "Ação bloqueada", description: "Não é possível excluir o único administrador do sistema." })
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário ${user.nome}? Essa ação não pode ser desfeita.`)) return

    try {
      await deleteDoc(doc(db, "usuarios", user.id))
      
      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "DELETE",
        modulo: "Usuários",
        registro_id: user.id,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Usuário excluído." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    }
  }

  // Prepara as opções de grupos para o Select
  const groupOptions = [
    { label: "Nenhum grupo", value: "" },
    ...grupos.map((g: any) => ({ label: g.nome, value: g.id }))
  ]

  return (
    <div className="max-w-6xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader 
          title="Usuários" 
          description="Gerencie os operadores, caixas e administradores do sistema."
          breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Usuários" }]}
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" asChild className="bg-rose-900 text-rose-50 hover:bg-rose-950">
            <Link href="/configuracoes/grupos-usuarios">
              <Users className="h-4 w-4 mr-2" />
              Grupos de usuários
            </Link>
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openNewUser}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      <ConfigCardSection>
        {/* BARRA DE BUSCA E FILTROS */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="w-full md:w-auto">
            <Filter className="h-4 w-4 mr-2" />
            Busca avançada
          </Button>
        </div>

        {/* TABELA DE USUÁRIOS */}
        <div className="border rounded-lg overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader>
              <ConfigDataTableRow>
                <ConfigDataTableHead>Nome</ConfigDataTableHead>
                <ConfigDataTableHead>Grupo</ConfigDataTableHead>
                <ConfigDataTableHead>E-mail</ConfigDataTableHead>
                <ConfigDataTableHead>Situação</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {isLoading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando usuários...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredUsuarios.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredUsuarios.map((user: any) => (
                  <ConfigDataTableRow key={user.id} className="hover:bg-slate-50/50">
                    <ConfigDataTableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                          {user.nome ? user.nome.charAt(0).toUpperCase() : "U"}
                        </div>
                        {user.nome}
                        {isUserOnlyAdmin(user.id) && <ShieldAlert className="h-4 w-4 text-amber-500 ml-1" title="Único administrador" />}
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>{getGrupoNome(user.grupo_id)}</ConfigDataTableCell>
                    <ConfigDataTableCell>{user.email}</ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <ConfigStatusBadge 
                        status={!user.permitir_acesso ? "SEM ACESSO" : user.status || "ATIVO"} 
                        variant={
                          !user.permitir_acesso ? "neutral" :
                          user.status === "ATIVO" ? "success" : 
                          user.status === "BLOQUEADO" ? "danger" : 
                          "neutral"
                        } 
                      />
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleBlockStatus(user)} title={user.status === "BLOQUEADO" ? "Desbloquear" : "Bloquear"}>
                          {user.status === "BLOQUEADO" ? (
                            <Unlock className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Lock className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditUser(user)} title="Editar">
                          <Edit3 className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(user)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </ConfigDataTableCell>
                  </ConfigDataTableRow>
                ))
              )}
            </ConfigDataTableBody>
          </ConfigDataTable>
        </div>
      </ConfigCardSection>

      {/* DIALOG DE CADASTRO/EDIÇÃO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <ConfigInputField 
              label="Nome Completo *" 
              id="user_nome"
              value={form.nome}
              onChange={e => handleUpdateField("nome", e.target.value)}
            />
            <ConfigInputField 
              label="E-mail de Acesso *" 
              id="user_email"
              type="email"
              value={form.email}
              onChange={e => handleUpdateField("email", e.target.value)}
            />
            <ConfigInputField 
              label="Telefone / Celular" 
              id="user_tel"
              value={form.telefone}
              onChange={e => handleUpdateField("telefone", e.target.value)}
            />
            <ConfigInputField 
              label="Cargo / Função" 
              id="user_cargo"
              value={form.cargo}
              onChange={e => handleUpdateField("cargo", e.target.value)}
            />
            
            <ConfigSelectField 
              label="Grupo de Permissão" 
              value={form.grupo_id}
              onValueChange={v => handleUpdateField("grupo_id", v)}
              options={groupOptions}
            />

            <ConfigSelectField 
              label="Status do Cadastro" 
              value={form.status}
              onValueChange={v => handleUpdateField("status", v)}
              options={[
                { label: "Ativo", value: "ATIVO" },
                { label: "Inativo", value: "INATIVO" },
                { label: "Bloqueado", value: "BLOQUEADO" },
              ]}
            />
            
            <div className="col-span-1 md:col-span-2 mt-4">
              <ConfigSwitchField 
                label="Permitir acesso ao sistema"
                description={form.permitir_acesso ? "Usuário pode fazer login e acessar o sistema" : "Usuário existe apenas para registro interno (ex: vendedor externo sem painel)"}
                checked={form.permitir_acesso}
                onCheckedChange={v => handleUpdateField("permitir_acesso", v)}
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <ConfigTextareaField 
                label="Observações Internas"
                id="user_obs"
                placeholder="Ex: Turno da manhã, restrição de uso..."
                value={form.observacoes}
                onChange={e => handleUpdateField("observacoes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingId ? "Atualizar Usuário" : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
