"use client"

import { useState } from "react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, deleteDoc, serverTimestamp, addDoc } from "firebase/firestore"
import { Plus, Users, Search, KeyRound, Eye, Edit3, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { grupoUsuarioSchema } from "@/types/configuracoes"

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
  ConfigTextareaField
} from "@/components/configuracoes/config-ui"

const emptyForm = {
  nome: "",
  descricao: "",
  cor: "#4f46e5",
  status: "ATIVO" as "ATIVO" | "INATIVO",
  is_admin: false,
}

export default function GruposUsuariosConfigPage() {
  const [searchTerm, setSearchTerm] = useState("")
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()
  
  // Queries
  const gruposQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.empresaId) return null
    return query(collection(db, "grupos_usuarios"), where("empresa_id", "==", activeProfile.empresaId))
  }, [db, activeProfile?.empresaId])

  // Buscar usuários para contar a quantidade vinculada
  const usuariosQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.empresaId) return null
    return query(collection(db, "usuarios"), where("empresa_id", "==", activeProfile.empresaId))
  }, [db, activeProfile?.empresaId])

  const { data: grupos = [], isLoading } = useCollection(gruposQuery)
  const { data: usuarios = [] } = useCollection(usuariosQuery)

  const filteredGrupos = grupos.filter((g: any) => {
    const term = searchTerm.toLowerCase()
    return g.nome?.toLowerCase().includes(term)
  })

  const getQtdUsuarios = (grupoId: string) => {
    return usuarios.filter((u: any) => u.grupo_id === grupoId).length
  }

  const openNewGroup = () => {
    setEditingId(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  const openEditGroup = (grupo: any) => {
    setEditingId(grupo.id)
    setForm({
      nome: grupo.nome || "",
      descricao: grupo.descricao || "",
      cor: grupo.cor || "#4f46e5",
      status: grupo.status || "ATIVO",
      is_admin: grupo.is_admin || false,
    })
    setIsModalOpen(true)
  }

  const handleUpdateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!db || !activeProfile) return

    // Previne nomes duplicados (opcional, mas boa prática)
    const nomeExists = grupos.some((g: any) => 
      g.nome.toLowerCase() === form.nome.toLowerCase() && g.id !== editingId
    )
    if (nomeExists) {
      return toast({ variant: "destructive", title: "Nome em uso", description: "Já existe um grupo com este nome." })
    }

    const payloadToValidate = {
      ...form,
      empresa_id: activeProfile.empresaId,
      atualizado_por: activeProfile.id
    }

    const validation = grupoUsuarioSchema.safeParse(payloadToValidate)
    if (!validation.success) {
      return toast({ variant: "destructive", title: "Erro de Validação", description: validation.error.errors[0].message })
    }

    setIsSaving(true)
    try {
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
      }

      let logAcao = "UPDATE"
      if (editingId) {
        await updateDoc(doc(db, "grupos_usuarios", editingId), dataToSave)
      } else {
        logAcao = "CREATE"
        await addDoc(collection(db, "grupos_usuarios"), {
          ...dataToSave,
          criado_em: serverTimestamp()
        })
      }

      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: logAcao,
        modulo: "Grupos de Usuários",
        registro_id: form.nome,
        data_hora: serverTimestamp(),
      })

      toast({ title: editingId ? "Grupo atualizado!" : "Grupo criado com sucesso!" })
      setIsModalOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (grupo: any) => {
    if (!db || !activeProfile) return

    const qtdUsuarios = getQtdUsuarios(grupo.id)
    if (qtdUsuarios > 0) {
      return toast({ 
        variant: "destructive", 
        title: "Ação bloqueada", 
        description: `Existem ${qtdUsuarios} usuário(s) vinculado(s) a este grupo. Remova-os primeiro.` 
      })
    }

    if (grupo.is_admin) {
       // Opcional: Se for admin root padrao do sistema não deixar excluir tao facil? 
       // Deixaremos excluir, desde que não tenha usuarios (já barrado acima)
    }

    if (!confirm(`Tem certeza que deseja excluir o grupo "${grupo.nome}"?`)) return

    try {
      await deleteDoc(doc(db, "grupos_usuarios", grupo.id))
      
      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "DELETE",
        modulo: "Grupos de Usuários",
        registro_id: grupo.id,
        detalhes: `Grupo "${grupo.nome}" deletado.`,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Grupo excluído." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    }
  }

  const handleNotImplemented = (msg: string) => {
    toast({ title: "Aviso", description: msg })
  }

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader 
          title="Grupos de Usuários" 
          description="Crie perfis e defina os níveis de acesso (Permissões) para os funcionários."
          breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Grupos" }]}
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" asChild className="bg-rose-900 text-rose-50 hover:bg-rose-950">
            <Link href="/configuracoes/usuarios">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </Link>
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openNewGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      <ConfigCardSection title="Pesquisa de grupos">
        {/* BARRA DE BUSCA */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome do grupo..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* TABELA DE GRUPOS */}
        <div className="border rounded-lg overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader>
              <ConfigDataTableRow>
                <ConfigDataTableHead>Grupo</ConfigDataTableHead>
                <ConfigDataTableHead className="text-center w-[180px]">Usuários vinculados</ConfigDataTableHead>
                <ConfigDataTableHead className="w-[120px]">Situação</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right w-[200px]">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {isLoading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Carregando grupos...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredGrupos.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum grupo encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredGrupos.map((grupo: any) => (
                  <ConfigDataTableRow key={grupo.id} className="hover:bg-slate-50/50">
                    <ConfigDataTableCell className="font-medium">
                      <div>
                        {grupo.cor && (
                          <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: grupo.cor }}></span>
                        )}
                        {grupo.nome}
                        {grupo.is_admin && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">ROOT</span>}
                      </div>
                      <div className="text-xs text-muted-foreground font-normal mt-0.5 truncate max-w-sm">
                        {grupo.descricao || "Sem descrição"}
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-center">
                      <div className="inline-flex items-center justify-center bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold">
                        {getQtdUsuarios(grupo.id)}
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <ConfigStatusBadge status={grupo.status || "ATIVO"} />
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild title="Permissões">
                          <Link href={`/configuracoes/permissoes?grupo_id=${grupo.id}`}>
                            <KeyRound className="h-4 w-4 text-purple-600" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleNotImplemented("Visualizar em breve.")} title="Visualizar">
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditGroup(grupo)} title="Editar">
                          <Edit3 className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(grupo)} title="Excluir">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Grupo" : "Novo Grupo de Usuários"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <ConfigInputField 
              label="Nome do Grupo *" 
              id="grupo_nome"
              value={form.nome}
              onChange={e => handleUpdateField("nome", e.target.value)}
            />

            <ConfigInputField 
              label="Cor de Identificação" 
              id="grupo_cor"
              type="color"
              value={form.cor}
              onChange={e => handleUpdateField("cor", e.target.value)}
            />
            
            <ConfigTextareaField 
              label="Descrição / Detalhes"
              id="grupo_desc"
              placeholder="O que os usuários desse grupo podem acessar?"
              value={form.descricao}
              onChange={e => handleUpdateField("descricao", e.target.value)}
            />

            <ConfigSelectField 
              label="Status" 
              value={form.status}
              onValueChange={v => handleUpdateField("status", v)}
              options={[
                { label: "Ativo", value: "ATIVO" },
                { label: "Inativo", value: "INATIVO" },
              ]}
            />
            
            {activeProfile?.isOwner && (
              <div className="pt-4 border-t mt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.is_admin} 
                    onChange={e => handleUpdateField("is_admin", e.target.checked)} 
                  />
                  <span className="font-semibold text-rose-700">Forçar privilégio de ROOT Admin</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 ml-5">Ignora a matriz de permissões e concede acesso total a tudo.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingId ? "Atualizar Grupo" : "Criar Grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
