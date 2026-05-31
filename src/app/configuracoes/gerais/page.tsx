"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Save, Store, Mail, Phone, Image as ImageIcon } from "lucide-react"
import { ConfigPageHeader } from "@/components/configuracoes/config-ui"

export default function ConfiguracoesGeraisPage() {
  const [form, setForm] = useState({
    nomeEmpresa: "TRUPE KIDS MODA INFANTIL",
    cnpj: "00.000.000/0001-00",
    emailSistema: "contato@trupekids.com.br",
    whatsappEmpresa: "(96) 99999-9999",
    timezone: "America/Belem",
    tema: "light",
    notificacaoEmail: true,
    notificacaoWhatsapp: true,
    auditoriaAtiva: true,
    backupAutomatico: true
  })

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader 
          title="Configurações Gerais" 
          description="Dados da empresa, aparência, integrações e rotinas automáticas."
          breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Gerais" }]}
        />
        <Button className="bg-primary text-white"><Save className="mr-2 h-4 w-4" /> Salvar alterações</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Dados da Empresa</h2>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome / Razão Social</Label>
              <Input value={form.nomeEmpresa} onChange={(e) => setForm({ ...form, nomeEmpresa: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> E-mail</Label>
                <Input value={form.emailSistema} onChange={(e) => setForm({ ...form, emailSistema: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> WhatsApp Oficial</Label>
                <Input value={form.whatsappEmpresa} onChange={(e) => setForm({ ...form, whatsappEmpresa: e.target.value })} />
              </div>
            </div>
            <div className="pt-2">
               <Label className="mb-2 block">Logo da Empresa</Label>
               <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-slate-50 cursor-pointer transition-colors">
                 <ImageIcon className="h-8 w-8 mb-2" />
                 <span className="text-sm font-medium">Clique para fazer upload</span>
               </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Sistema e Segurança</h2>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Timezone Padrão</Label>
                <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label>Log de Auditoria</Label>
                  <div className="text-xs text-muted-foreground">Gravar todas as ações críticas no banco</div>
                </div>
                <Switch checked={form.auditoriaAtiva} onCheckedChange={(checked) => setForm({ ...form, auditoriaAtiva: checked })} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <Label>Backup Automático</Label>
                  <div className="text-xs text-muted-foreground">Sincronização redundante dos dados</div>
                </div>
                <Switch checked={form.backupAutomatico} onCheckedChange={(checked) => setForm({ ...form, backupAutomatico: checked })} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Notificações Inteligentes</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Avisos por E-mail</Label>
                <Switch checked={form.notificacaoEmail} onCheckedChange={(checked) => setForm({ ...form, notificacaoEmail: checked })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Integração WhatsApp Bot</Label>
                <Switch checked={form.notificacaoWhatsapp} onCheckedChange={(checked) => setForm({ ...form, notificacaoWhatsapp: checked })} />
              </div>
              <div className="mt-4 pt-4 border-t">
                 <Button variant="outline" className="w-full">Configurar API WhatsApp</Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
