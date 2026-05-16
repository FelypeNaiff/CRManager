"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

const defaultProfiles = [
  { id: 1, nome: "Administrador", descricao: "Acesso total ao sistema", status: "Ativo", usuarios: 3 },
  { id: 2, nome: "Vendedor", descricao: "Permissões de vendas e PDV", status: "Ativo", usuarios: 8 },
  { id: 3, nome: "Financeiro", descricao: "Controle financeiro e contas", status: "Inativo", usuarios: 2 },
]

export default function ConfiguracoesPerfisAcessoPage() {
  const [form, setForm] = useState<{
    nome: string
    descricao: string
    status: string
    permissoes: string[]
    usuariosVinculados: string
  }>({
    nome: "",
    descricao: "",
    status: "Ativo",
    permissoes: [],
    usuariosVinculados: "",
  })

  const permissaoOptions = [
    "Visualizar",
    "Criar",
    "Editar",
    "Excluir",
    "Exportar",
    "Imprimir",
    "Aprovar",
    "Cancelar",
    "Configurar",
  ]

  const togglePermissao = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissoes: prev.permissoes.includes(perm)
        ? prev.permissoes.filter((p) => p !== perm)
        : [...prev.permissoes, perm],
    }))
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Perfis de Acesso</h1>
          <p className="mt-2 text-muted-foreground">Configure perfis e atribua permissões e usuários vinculados.</p>
        </div>
        <Button className="bg-primary text-white">+ Novo perfil</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Criar / editar perfil</h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome do perfil</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usuariosVinculados">Usuários vinculados</Label>
                <Input id="usuariosVinculados" value={form.usuariosVinculados} onChange={(e) => setForm({ ...form, usuariosVinculados: e.target.value })} placeholder="Nomes ou IDs" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Permissões vinculadas</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {permissaoOptions.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-slate-50">
                    <Checkbox checked={form.permissoes.includes(perm)} onCheckedChange={() => togglePermissao(perm)} />
                    <span>{perm}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline">Cancelar</Button>
              <Button className="bg-primary text-white">Salvar perfil</Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Perfis sugeridos</h2>
          <div className="space-y-3 text-sm text-slate-600">
            <p>Use os modelos abaixo como ponto de partida para a definição de permissões.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Administrador</li>
              <li>Gerente</li>
              <li>Vendedor</li>
              <li>Financeiro</li>
              <li>Estoque</li>
              <li>Marketing</li>
              <li>Atendimento</li>
              <li>Somente leitura</li>
            </ul>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Usuários</th>
                </tr>
              </thead>
              <tbody>
                {defaultProfiles.map((profile) => (
                  <tr key={profile.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{profile.nome}</td>
                    <td className="px-4 py-3">{profile.descricao}</td>
                    <td className="px-4 py-3">{profile.status}</td>
                    <td className="px-4 py-3">{profile.usuarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
