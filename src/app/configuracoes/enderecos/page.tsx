"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ConfiguracoesEnderecosPage() {
  const [form, setForm] = useState({
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    pais: "",
    referencia: "",
    latitude: "",
    longitude: "",
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Endereços</h1>
          <p className="mt-2 text-muted-foreground">Configure o endereço principal da empresa e as coordenadas de mapa.</p>
        </div>
        <Button className="bg-primary text-white">Salvar endereço</Button>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="cep">CEP</Label>
            <Input id="cep" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rua">Rua</Label>
            <Input id="rua" value={form.rua} onChange={(e) => setForm({ ...form, rua: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="numero">Número</Label>
            <Input id="numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="complemento">Complemento</Label>
            <Input id="complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input id="bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Input id="estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pais">País</Label>
            <Input id="pais" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="referencia">Referência</Label>
            <Input id="referencia" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input id="latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input id="longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Recursos</h2>
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
          <li>Busca automática por CEP</li>
          <li>Mapa integrado</li>
          <li>Botão abrir rota</li>
        </ul>
      </section>
    </div>
  )
}
