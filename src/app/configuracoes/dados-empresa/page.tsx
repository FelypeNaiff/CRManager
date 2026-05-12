"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ConfiguracoesDadosEmpresaPage() {
  const [form, setForm] = useState({
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    crt: "Simples",
    dataAbertura: "",
    site: "",
    email: "",
    whatsapp: "",
    telefone: "",
    responsavel: "",
    cpfResponsavel: "",
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dados da Empresa</h1>
          <p className="mt-2 text-muted-foreground">Atualize os dados fiscais e de contato da empresa.</p>
        </div>
        <Button className="bg-primary text-white">Salvar alterações</Button>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Dados principais</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input id="razaoSocial" value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nomeFantasia">Nome fantasia</Label>
            <Input id="nomeFantasia" value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inscricaoEstadual">Inscrição estadual</Label>
            <Input id="inscricaoEstadual" value={form.inscricaoEstadual} onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inscricaoMunicipal">Inscrição municipal</Label>
            <Input id="inscricaoMunicipal" value={form.inscricaoMunicipal} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="crt">CRT</Label>
            <Select value={form.crt} onValueChange={(value) => setForm({ ...form, crt: value })}>
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
            <Label htmlFor="dataAbertura">Data de abertura</Label>
            <Input id="dataAbertura" type="date" value={form.dataAbertura} onChange={(e) => setForm({ ...form, dataAbertura: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site">Site</Label>
            <Input id="site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail principal</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="whatsapp">WhatsApp principal</Label>
            <Input id="whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="telefone">Telefone fixo</Label>
            <Input id="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="responsavel">Responsável legal</Label>
            <Input id="responsavel" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cpfResponsavel">CPF responsável</Label>
            <Input id="cpfResponsavel" value={form.cpfResponsavel} onChange={(e) => setForm({ ...form, cpfResponsavel: e.target.value })} />
          </div>
        </div>
      </section>
    </div>
  )
}
