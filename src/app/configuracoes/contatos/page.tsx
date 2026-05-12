"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ConfiguracoesContatosPage() {
  const [form, setForm] = useState({
    whatsappVendas: "",
    whatsappSuporte: "",
    telefoneComercial: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    linkedin: "",
    youtube: "",
    emailFinanceiro: "",
    emailFiscal: "",
    emailRH: "",
    emailSuporte: "",
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contatos</h1>
          <p className="mt-2 text-muted-foreground">Configure os canais comerciais e internos da empresa.</p>
        </div>
        <Button className="bg-primary text-white">Salvar contatos</Button>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Contatos comerciais</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="whatsappVendas">WhatsApp vendas</Label>
            <Input id="whatsappVendas" value={form.whatsappVendas} onChange={(e) => setForm({ ...form, whatsappVendas: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="whatsappSuporte">WhatsApp suporte</Label>
            <Input id="whatsappSuporte" value={form.whatsappSuporte} onChange={(e) => setForm({ ...form, whatsappSuporte: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="telefoneComercial">Telefone comercial</Label>
            <Input id="telefoneComercial" value={form.telefoneComercial} onChange={(e) => setForm({ ...form, telefoneComercial: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="facebook">Facebook</Label>
            <Input id="facebook" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tiktok">TikTok</Label>
            <Input id="tiktok" value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input id="linkedin" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="youtube">YouTube</Label>
            <Input id="youtube" value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Contatos internos</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="emailFinanceiro">E-mail financeiro</Label>
            <Input id="emailFinanceiro" type="email" value={form.emailFinanceiro} onChange={(e) => setForm({ ...form, emailFinanceiro: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emailFiscal">E-mail fiscal</Label>
            <Input id="emailFiscal" type="email" value={form.emailFiscal} onChange={(e) => setForm({ ...form, emailFiscal: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emailRH">E-mail RH</Label>
            <Input id="emailRH" type="email" value={form.emailRH} onChange={(e) => setForm({ ...form, emailRH: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emailSuporte">E-mail suporte</Label>
            <Input id="emailSuporte" type="email" value={form.emailSuporte} onChange={(e) => setForm({ ...form, emailSuporte: e.target.value })} />
          </div>
        </div>
      </section>
    </div>
  )
}
