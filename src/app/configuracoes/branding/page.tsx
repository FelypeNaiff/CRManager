"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function ConfiguracoesBrandingPage() {
  const [form, setForm] = useState({
    logoPrincipal: "",
    logoReduzida: "",
    favicon: "",
    corPrimaria: "",
    corSecundaria: "",
    tema: "claro",
    imagemLogin: "",
    imagemDashboard: "",
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="mt-2 text-muted-foreground">Personalize cores, logos e imagens do sistema.</p>
        </div>
        <Button className="bg-primary text-white">Salvar branding</Button>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="logoPrincipal">Logo principal</Label>
            <Input id="logoPrincipal" placeholder="URL" value={form.logoPrincipal} onChange={(e) => setForm({ ...form, logoPrincipal: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="logoReduzida">Logo reduzida</Label>
            <Input id="logoReduzida" placeholder="URL" value={form.logoReduzida} onChange={(e) => setForm({ ...form, logoReduzida: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="favicon">Favicon</Label>
            <Input id="favicon" placeholder="URL" value={form.favicon} onChange={(e) => setForm({ ...form, favicon: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="corPrimaria">Cor primária</Label>
            <Input id="corPrimaria" placeholder="#000000" value={form.corPrimaria} onChange={(e) => setForm({ ...form, corPrimaria: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="corSecundaria">Cor secundária</Label>
            <Input id="corSecundaria" placeholder="#ffffff" value={form.corSecundaria} onChange={(e) => setForm({ ...form, corSecundaria: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tema">Tema</Label>
            <select className="rounded-md border p-2" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })}>
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="imagemLogin">Imagem login</Label>
            <Input id="imagemLogin" placeholder="URL" value={form.imagemLogin} onChange={(e) => setForm({ ...form, imagemLogin: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="imagemDashboard">Imagem dashboard</Label>
            <Input id="imagemDashboard" placeholder="URL" value={form.imagemDashboard} onChange={(e) => setForm({ ...form, imagemDashboard: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
          <h3 className="text-lg font-semibold">Preview em tempo real</h3>
          <div className="grid gap-4 mt-4 md:grid-cols-2">
            <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
              <p className="font-medium">Barra de navegação</p>
              <p>Cor primária: {form.corPrimaria || "#000000"}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
              <p className="font-medium">Tela de login</p>
              <p>Imagem: {form.imagemLogin ? "Definida" : "Não definida"}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
