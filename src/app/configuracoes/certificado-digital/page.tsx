"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { FileText, RefreshCcw, Trash2 } from "lucide-react"

export default function ConfiguracoesCertificadoDigitalPage() {
  const [form, setForm] = useState({
    tipo: "A1",
    nome: "Certificado Principal",
    cnpj: "12.345.678/0001-90",
    emissao: "2025-06-01",
    vencimento: "2026-06-01",
    senha: "",
    arquivo: "",
    status: "Ativo",
    observacoes: "Certificado cadastrado para emissão de notas fiscais eletrônicas.",
  })

  const daysUntilExpiration = useMemo(() => {
    const today = new Date()
    const expireDate = new Date(form.vencimento)
    const diff = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }, [form.vencimento])

  const urgency = useMemo(() => {
    if (daysUntilExpiration <= 0) return "Vencido"
    if (daysUntilExpiration <= 15) return "Próximo do vencimento"
    return "Ativo"
  }, [daysUntilExpiration])

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Configurações</p>
            <h1 className="mt-2 text-3xl font-bold">Certificado Digital</h1>
            <p className="mt-2 text-muted-foreground">Cadastre e gerencie o certificado digital da empresa com validação e testes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Link href="/configuracoes" className="text-primary hover:underline">Configurações</Link>
            <span>/</span>
            <span>Certificado Digital</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Detalhes do certificado</h2>
                <p className="mt-1 text-sm text-slate-600">Campos para cadastro e renovação do certificado digital.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="border-slate-200 text-slate-700">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Testar Certificado
                </Button>
                <Button className="bg-primary text-white">
                  <FileText className="mr-2 h-4 w-4" />
                  Substituir Certificado
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de certificado</Label>
                <Select value={form.tipo} onValueChange={(value) => setForm({ ...form, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="A3">A3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do certificado</Label>
                <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ vinculado</Label>
                <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emissao">Data de emissão</Label>
                <Input id="emissao" type="date" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vencimento">Data de vencimento</Label>
                <Input id="vencimento" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha do certificado</Label>
                <Input id="senha" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="arquivo">Upload do arquivo</Label>
                <Input
                  id="arquivo"
                  type="text"
                  placeholder="Arraste ou cole o caminho do arquivo .pfx / .p12"
                  value={form.arquivo}
                  onChange={(e) => setForm({ ...form, arquivo: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" value={form.status} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" rows={4} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${urgency === "Vencido" ? "border-destructive/30 bg-destructive/10" : urgency === "Próximo do vencimento" ? "border-amber-300 bg-amber-100" : "border-emerald-200 bg-emerald-100"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Status do certificado</p>
                  <p className="text-sm text-slate-700">{urgency === "Vencido" ? "Este certificado está vencido." : urgency === "Próximo do vencimento" ? "Este certificado vence em breve." : "Certificado válido."}</p>
                </div>
                <Badge variant={urgency === "Vencido" ? "destructive" : urgency === "Próximo do vencimento" ? "secondary" : "secondary"}>{urgency}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-600">Vencimento em {daysUntilExpiration} dias. Não remova o certificado ativo sem confirmação.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="bg-primary text-white">Salvar Certificado</Button>
            <Button variant="outline" className="border-slate-200 text-slate-700">
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Certificado
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Logs de alteração</h2>
              <p className="mt-1 text-sm text-slate-600">Histórico de mudanças do certificado digital.</p>
            </div>
            <Button variant="outline">Visualizar todos</Button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Detalhes</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-3">2026-05-01 09:22</td>
                  <td className="px-4 py-3">Cadastro</td>
                  <td className="px-4 py-3">Lucas Silva</td>
                  <td className="px-4 py-3">Certificado inserido com sucesso</td>
                  <td className="px-4 py-3">192.168.0.11</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-3">2026-05-20 15:30</td>
                  <td className="px-4 py-3">Teste</td>
                  <td className="px-4 py-3">Mariana Costa</td>
                  <td className="px-4 py-3">Verificação de validade bem sucedida</td>
                  <td className="px-4 py-3">192.168.0.25</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
