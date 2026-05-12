"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function ConfiguracoesFinanceiroFiscalPage() {
  const [form, setForm] = useState({
    regime: "Simples",
    cnaePrincipal: "",
    cnaesSecundarios: "",
    aliquota: "",
    serieNFCe: "",
    ambiente: "Homologação",
    banco: "",
    agencia: "",
    conta: "",
    pix: "",
    favorecido: "",
    cnpjFavorecido: "",
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financeiro / Fiscal</h1>
          <p className="mt-2 text-muted-foreground">Configure regime tributário, CNAEs e dados bancários.</p>
        </div>
        <Button className="bg-primary text-white">Salvar alterações</Button>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Dados fiscais</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="regime">Regime tributário</Label>
            <Select value={form.regime} onValueChange={(value) => setForm({ ...form, regime: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Simples">Simples</SelectItem>
                <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                <SelectItem value="Lucro Real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cnaePrincipal">CNAE principal</Label>
            <Input id="cnaePrincipal" value={form.cnaePrincipal} onChange={(e) => setForm({ ...form, cnaePrincipal: e.target.value })} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="cnaesSecundarios">CNAEs secundários</Label>
            <Textarea id="cnaesSecundarios" rows={3} value={form.cnaesSecundarios} onChange={(e) => setForm({ ...form, cnaesSecundarios: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="aliquota">Alíquota padrão</Label>
            <Input id="aliquota" value={form.aliquota} onChange={(e) => setForm({ ...form, aliquota: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="serieNFCe">Série NFC-e</Label>
            <Input id="serieNFCe" value={form.serieNFCe} onChange={(e) => setForm({ ...form, serieNFCe: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ambiente">Ambiente</Label>
            <Select value={form.ambiente} onValueChange={(value) => setForm({ ...form, ambiente: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Homologação">Homologação</SelectItem>
                <SelectItem value="Produção">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Dados bancários</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="banco">Banco</Label>
            <Input id="banco" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agencia">Agência</Label>
            <Input id="agencia" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="conta">Conta</Label>
            <Input id="conta" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pix">PIX</Label>
            <Input id="pix" value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="favorecido">Favorecido</Label>
            <Input id="favorecido" value={form.favorecido} onChange={(e) => setForm({ ...form, favorecido: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cnpjFavorecido">CNPJ favorecido</Label>
            <Input id="cnpjFavorecido" value={form.cnpjFavorecido} onChange={(e) => setForm({ ...form, cnpjFavorecido: e.target.value })} />
          </div>
        </div>
      </section>
    </div>
  )
}
