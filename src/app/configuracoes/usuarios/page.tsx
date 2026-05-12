"use client"

export const dynamic = 'force-dynamic'

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, UserCog, ShieldCheck, History, FileText, Plus, Eye, Edit3, ShieldOff, Key, Trash2 } from "lucide-react"

type User = {
  id: number
  nome: string
  email: string
  cargo: string
  perfil: string
  status: string
  ultimoAcesso: string
}

type UserForm = Omit<User, "id"> & { id?: number }

type Filters = {
  nome: string
  email: string
  perfil: string
  status: string
}

const accessProfiles = [
  "Administrador",
  "Gerente",
  "Vendedor",
  "Financeiro",
  "Estoque",
  "Marketing",
  "Atendimento",
  "Somente leitura",
]

const statusOptions = ["Ativo", "Inativo", "Bloqueado"]

const initialUsers: User[] = [
  { id: 1, nome: "Lucas Silva", email: "lucas@exemplo.com", cargo: "Gerente", perfil: "Gerente", status: "Ativo", ultimoAcesso: "2026-05-10 14:22" },
  { id: 2, nome: "Mariana Costa", email: "mariana@exemplo.com", cargo: "Vendedor", perfil: "Vendedor", status: "Bloqueado", ultimoAcesso: "2026-05-09 08:03" },
  { id: 3, nome: "Ana Pereira", email: "ana@exemplo.com", cargo: "Financeiro", perfil: "Financeiro", status: "Ativo", ultimoAcesso: "2026-05-08 17:40" },
  { id: 4, nome: "Carlos Alves", email: "carlos@exemplo.com", cargo: "Estoque", perfil: "Estoque", status: "Inativo", ultimoAcesso: "2026-05-05 12:15" },
]

const perfisData = [
  { nome: "Administrador", descricao: "Acesso total ao sistema", status: "Ativo", usuarios: 4 },
  { nome: "Gerente", descricao: "Controle de vendas e equipe", status: "Ativo", usuarios: 2 },
  { nome: "Vendedor", descricao: "Acesso ao PDV e clientes", status: "Ativo", usuarios: 7 },
  { nome: "Financeiro", descricao: "Acesso às contas e relatórios", status: "Ativo", usuarios: 3 },
  { nome: "Estoque", descricao: "Gerência de estoque e produtos", status: "Ativo", usuarios: 2 },
  { nome: "Marketing", descricao: "Campanhas e comunicação", status: "Ativo", usuarios: 1 },
  { nome: "Atendimento", descricao: "Suporte ao cliente", status: "Ativo", usuarios: 3 },
  { nome: "Somente leitura", descricao: "Apenas visualização", status: "Ativo", usuarios: 6 },
]

const modules = [
  { name: "Dashboard" },
  { name: "CRM" },
  { name: "Vendas" },
  { name: "Estoque" },
  { name: "Financeiro" },
  { name: "Marketing" },
  { name: "Relatórios" },
  { name: "Agenda" },
  { name: "Configurações" },
]

const permissions = [
  "Visualizar",
  "Criar",
  "Editar",
  "Excluir",
  "Exportar",
  "Imprimir",
  "Cancelar",
  "Configurar",
]

const accessLogs = [
  { id: 1, usuario: "Lucas Silva", data: "2026-05-10 14:22", ip: "192.168.0.11", dispositivo: "Desktop", navegador: "Chrome", status: "Sucesso" },
  { id: 2, usuario: "Mariana Costa", data: "2026-05-09 08:03", ip: "192.168.0.25", dispositivo: "Mobile", navegador: "Safari", status: "Falha" },
  { id: 3, usuario: "Ana Pereira", data: "2026-05-08 17:40", ip: "192.168.0.98", dispositivo: "Desktop", navegador: "Firefox", status: "Sucesso" },
]

const activityLogs = [
  { id: 1, usuario: "Lucas Silva", acao: "Criou usuário", modulo: "Usuários", registro: "Mariana Costa", data: "2026-05-10 14:23", ip: "192.168.0.11" },
  { id: 2, usuario: "Mariana Costa", acao: "Atualizou perfil", modulo: "Usuários", registro: "Vendedor", data: "2026-05-09 08:05", ip: "192.168.0.25" },
  { id: 3, usuario: "Ana Pereira", acao: "Bloqueou usuário", modulo: "Usuários", registro: "Carlos Alves", data: "2026-05-08 17:45", ip: "192.168.0.98" },
]

const tabs = [
  { value: "usuarios", label: "Usuários", icon: Users },
  { value: "perfis", label: "Perfis de Acesso", icon: UserCog },
  { value: "permissoes", label: "Permissões", icon: ShieldCheck },
  { value: "historico", label: "Histórico de Acessos", icon: History },
  { value: "logs", label: "Logs de Atividades", icon: FileText },
]

const defaultUserForm: UserForm = {
  nome: "",
  email: "",
  cargo: "",
  perfil: "Administrador",
  status: "Ativo",
  ultimoAcesso: "Nunca",
}

export default function ConfiguracoesUsuariosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryTab = searchParams.get("tab") ?? "usuarios"
  const [activeTab, setActiveTab] = useState(queryTab)
  const [filters, setFilters] = useState<Filters>({ nome: "", email: "", perfil: "Todos", status: "Todos" })
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordValue, setPasswordValue] = useState("")

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null

  useEffect(() => {
    setActiveTab(queryTab)
  }, [queryTab])

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/configuracoes/usuarios?${params.toString()}`)
    setActiveTab(value)
  }

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (filters.nome && !user.nome.toLowerCase().includes(filters.nome.toLowerCase())) return false
        if (filters.email && !user.email.toLowerCase().includes(filters.email.toLowerCase())) return false
        if (filters.perfil !== "Todos" && user.perfil !== filters.perfil) return false
        if (filters.status !== "Todos" && user.status !== filters.status) return false
        return true
      }),
    [filters, users]
  )

  const openNewUserDialog = () => {
    setSelectedUserId(null)
    setUserForm(defaultUserForm)
    setShowUserDialog(true)
  }

  const openEditUserDialog = (user: User) => {
    setSelectedUserId(user.id)
    setUserForm({ ...user })
    setShowUserDialog(true)
  }

  const handleSaveUser = () => {
    if (!userForm.nome || !userForm.email) {
      return
    }

    if (selectedUserId) {
      setUsers((prev) => prev.map((user) => (user.id === selectedUserId ? { ...user, ...userForm } : user)))
    } else {
      setUsers((prev) => [
        ...prev,
        {
          id: Date.now(),
          nome: userForm.nome,
          email: userForm.email,
          cargo: userForm.cargo,
          perfil: userForm.perfil,
          status: userForm.status,
          ultimoAcesso: "Nunca",
        },
      ])
    }

    setShowUserDialog(false)
  }

  const handleToggleStatus = (user: User) => {
    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? {
              ...item,
              status: item.status === "Ativo" ? "Bloqueado" : "Ativo",
            }
          : item
      )
    )
  }

  const handleDeleteUser = (userId: number) => {
    if (window.confirm("Tem certeza que deseja excluir este usuário?")) {
      setUsers((prev) => prev.filter((user) => user.id !== userId))
      if (selectedUserId === userId) {
        setSelectedUserId(null)
        setShowUserDialog(false)
      }
    }
  }

  const handleResetPassword = (user: User) => {
    setSelectedUserId(user.id)
    setPasswordValue("")
    setShowPasswordDialog(true)
  }

  const savePassword = () => {
    setShowPasswordDialog(false)
    setPasswordValue("")
  }

  const handleUserFormChange = (field: keyof UserForm, value: string) => {
    setUserForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Configurações</p>
            <h1 className="mt-2 text-3xl font-bold">Usuários</h1>
            <p className="mt-2 text-muted-foreground">Gerencie usuários, perfis e permissões com auditoria integrada.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Link href="/configuracoes" className="text-primary hover:underline">Configurações</Link>
            <span>/</span>
            <span>Usuários</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card text-slate-700"
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </div>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="usuarios">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Lista de usuários</h2>
                  <p className="mt-1 text-sm text-slate-600">Filtros por nome, e-mail, perfil e status.</p>
                </div>
                <Button className="bg-primary text-white" onClick={openNewUserDialog}>
                  <Plus className="h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="filtroNome">Nome</Label>
                  <Input id="filtroNome" value={filters.nome} onChange={(e) => setFilters({ ...filters, nome: e.target.value })} placeholder="Buscar nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filtroEmail">E-mail</Label>
                  <Input id="filtroEmail" value={filters.email} onChange={(e) => setFilters({ ...filters, email: e.target.value })} placeholder="Buscar e-mail" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filtroPerfil">Perfil</Label>
                  <Select value={filters.perfil} onValueChange={(value) => setFilters({ ...filters, perfil: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      {accessProfiles.map((perfil) => (
                        <SelectItem key={perfil} value={perfil}>{perfil}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filtroStatus">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">E-mail</th>
                      <th className="px-4 py-3">Cargo</th>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Último acesso</th>
                      <th className="px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{user.nome}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">{user.cargo}</td>
                        <td className="px-4 py-3">{user.perfil}</td>
                        <td className="px-4 py-3">{user.status}</td>
                        <td className="px-4 py-3">{user.ultimoAcesso}</td>
                        <td className="px-4 py-3 flex flex-wrap gap-2">
                          <Button variant="outline" size="icon" title="Visualizar" onClick={() => openEditUserDialog(user)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Editar" onClick={() => openEditUserDialog(user)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Bloquear / Desbloquear" onClick={() => handleToggleStatus(user)}>
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Redefinir senha" onClick={() => handleResetPassword(user)}>
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" title="Excluir" onClick={() => handleDeleteUser(user.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="perfis">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Perfis de Acesso</h2>
                  <p className="mt-1 text-sm text-slate-600">Defina modelos de permissão e acompanhe quantos usuários estão vinculados.</p>
                </div>
                <Button className="bg-primary text-white">
                  <Plus className="h-4 w-4" />
                  Novo Perfil
                </Button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Usuários vinculados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfisData.map((perfil) => (
                      <tr key={perfil.nome} className="border-t">
                        <td className="px-4 py-3 font-medium">{perfil.nome}</td>
                        <td className="px-4 py-3">{perfil.descricao}</td>
                        <td className="px-4 py-3">{perfil.status}</td>
                        <td className="px-4 py-3">{perfil.usuarios}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="permissoes">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Permissões por Módulo</h2>
                  <p className="mt-1 text-sm text-slate-600">Configure a matriz de ações por módulo do sistema.</p>
                </div>
                <Button className="bg-primary text-white">Salvar matriz</Button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Módulo</th>
                      {permissions.map((permission) => (
                        <th key={permission} className="px-4 py-3">{permission}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => (
                      <tr key={module.name} className="border-t">
                        <td className="px-4 py-3 font-medium">{module.name}</td>
                        {permissions.map((permission) => (
                          <td key={permission} className="px-4 py-3">
                            <Checkbox checked={false} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="historico">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Histórico de Acessos</h2>
                  <p className="mt-1 text-sm text-slate-600">Veja registros de login e tentativas de acesso por usuário.</p>
                </div>
                <Button variant="outline">Exportar CSV</Button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Usuário</th>
                      <th className="px-4 py-3">Data/hora</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">Dispositivo</th>
                      <th className="px-4 py-3">Navegador</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="px-4 py-3">{log.usuario}</td>
                        <td className="px-4 py-3">{log.data}</td>
                        <td className="px-4 py-3">{log.ip}</td>
                        <td className="px-4 py-3">{log.dispositivo}</td>
                        <td className="px-4 py-3">{log.navegador}</td>
                        <td className="px-4 py-3">{log.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Logs de Atividades</h2>
                  <p className="mt-1 text-sm text-slate-600">Auditoria de ações realizadas no painel de configurações.</p>
                </div>
                <Button variant="outline">Exportar CSV</Button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Usuário</th>
                      <th className="px-4 py-3">Ação</th>
                      <th className="px-4 py-3">Módulo</th>
                      <th className="px-4 py-3">Registro alterado</th>
                      <th className="px-4 py-3">Data/hora</th>
                      <th className="px-4 py-3">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="px-4 py-3">{log.usuario}</td>
                        <td className="px-4 py-3">{log.acao}</td>
                        <td className="px-4 py-3">{log.modulo}</td>
                        <td className="px-4 py-3">{log.registro}</td>
                        <td className="px-4 py-3">{log.data}</td>
                        <td className="px-4 py-3">{log.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {selectedUser ? "Atualize os dados do usuário e salve para aplicar as alterações." : "Cadastre um usuário novo com perfil e status."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeUsuario">Nome</Label>
              <Input id="nomeUsuario" value={userForm.nome} onChange={(e) => handleUserFormChange("nome", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailUsuario">E-mail</Label>
              <Input id="emailUsuario" type="email" value={userForm.email} onChange={(e) => handleUserFormChange("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargoUsuario">Cargo</Label>
              <Input id="cargoUsuario" value={userForm.cargo} onChange={(e) => handleUserFormChange("cargo", e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="perfilUsuario">Perfil de Acesso</Label>
                <Select id="perfilUsuario" value={userForm.perfil} onValueChange={(value) => handleUserFormChange("perfil", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessProfiles.map((perfil) => (
                      <SelectItem key={perfil} value={perfil}>{perfil}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="statusUsuario">Status</Label>
                <Select id="statusUsuario" value={userForm.status} onValueChange={(value) => handleUserFormChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveUser}>{selectedUser ? "Salvar alterações" : "Criar usuário"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Informe a nova senha para {selectedUser?.nome ?? "o usuário"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="novaSenha">Nova senha</Label>
              <Input id="novaSenha" type="password" value={passwordValue} onChange={(e) => setPasswordValue(e.target.value)} placeholder="Digite a nova senha" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
            <Button onClick={savePassword}>Salvar senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
