"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ConfigPageHeader } from "@/components/configuracoes/config-ui"
import { Save, MonitorSmartphone, Receipt, CreditCard } from "lucide-react"

export default function ConfiguracoesPDVPage() {
  const [form, setForm] = useState({
    pdvAtivo: true,
    imprimirAutomaticamente: false,
    abrirCaixaObrigatorio: true,
    fechamentoCego: false,
    controleDesconto: true,
    descontoMaximo: "10",
    exigirPinDesconto: true,
    vendaSemEstoque: false,
    vendaNegativa: false,
    tefIntegrado: false,
    nfceAtivo: true,
    pixAutomatico: true
  })

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader 
          title="Configurações PDV" 
          description="Regras de frente de caixa, aprovações, emissão de notas e recebimentos."
          breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "PDV" }]}
        />
        <Button className="bg-primary text-white"><Save className="mr-2 h-4 w-4" /> Salvar configurações</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-primary" /> Regras do Caixa</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between"><Label>Ativar Módulo PDV</Label><Switch checked={form.pdvAtivo} onCheckedChange={(checked) => setForm({ ...form, pdvAtivo: checked })} /></div>
            <div className="flex items-center justify-between"><Label>Abertura de Caixa Obrigatória</Label><Switch checked={form.abrirCaixaObrigatorio} onCheckedChange={(checked) => setForm({ ...form, abrirCaixaObrigatorio: checked })} /></div>
            <div className="flex items-center justify-between"><Label>Fechamento Cego (Ocultar Saldo)</Label><Switch checked={form.fechamentoCego} onCheckedChange={(checked) => setForm({ ...form, fechamentoCego: checked })} /></div>
            
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between"><Label>Permitir venda sem estoque</Label><Switch checked={form.vendaSemEstoque} onCheckedChange={(checked) => setForm({ ...form, vendaSemEstoque: checked })} /></div>
              <div className="flex items-center justify-between"><Label className="text-rose-600">Permitir venda negativa</Label><Switch checked={form.vendaNegativa} onCheckedChange={(checked) => setForm({ ...form, vendaNegativa: checked })} /></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Descontos e Autorizações</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4"><Label>Bloquear Desconto Acima do Limite</Label><Switch checked={form.controleDesconto} onCheckedChange={(checked) => setForm({ ...form, controleDesconto: checked })} /></div>
            <div className="grid gap-2">
              <Label>Desconto Máximo Padrão (%)</Label>
              <Input type="number" disabled={!form.controleDesconto} value={form.descontoMaximo} onChange={(e) => setForm({ ...form, descontoMaximo: e.target.value })} />
            </div>
            <div className="flex items-center justify-between pt-4 mt-2 border-t">
              <div className="space-y-0.5">
                <Label>Exigir PIN do Administrador</Label>
                <div className="text-xs text-muted-foreground">Para autorizar descontos excedentes</div>
              </div>
              <Switch checked={form.exigirPinDesconto} onCheckedChange={(checked) => setForm({ ...form, exigirPinDesconto: checked })} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Pagamentos e Impressão</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 border-r pr-6">
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">INTEGRAÇÕES FÍSICAS</h3>
               <div className="flex items-center justify-between"><Label>TEF Integrado (Maquininha Smart)</Label><Switch checked={form.tefIntegrado} onCheckedChange={(checked) => setForm({ ...form, tefIntegrado: checked })} /></div>
               <div className="flex items-center justify-between"><Label>PIX Dinâmico (QR Code na Tela)</Label><Switch checked={form.pixAutomatico} onCheckedChange={(checked) => setForm({ ...form, pixAutomatico: checked })} /></div>
               <div className="flex items-center justify-between"><Label>Emissão NFC-e/SAT Automática</Label><Switch checked={form.nfceAtivo} onCheckedChange={(checked) => setForm({ ...form, nfceAtivo: checked })} /></div>
            </div>
            <div className="space-y-4">
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">COMPROVANTES</h3>
               <div className="flex items-center justify-between"><Label>Imprimir Comprovante Não-Fiscal Automaticamente</Label><Switch checked={form.imprimirAutomaticamente} onCheckedChange={(checked) => setForm({ ...form, imprimirAutomaticamente: checked })} /></div>
               <div className="grid gap-2 mt-4">
                 <Label>Modelo Impressora Padrão</Label>
                 <Input placeholder="Ex: TM-T20 Bematech, Impressora Windows..." />
               </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}