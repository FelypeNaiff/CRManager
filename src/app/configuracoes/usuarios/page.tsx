"use client"
import React, { useState } from 'react'

export default function UsuariosPage() {
  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    email: '',
    senhaInicial: '',
    perfil: 'VENDEDOR',
    status: 'ACTIVE'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated submission flow
    // 1. Create in Supabase Auth
    // 2. Create in Prisma
    // 3. Link Role and Permissions
    console.log("Submitting user creation:", formData)
    alert("Usuário criado com sucesso no Supabase e Prisma!")
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Gestão de Usuários</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block mb-1">Nome</label>
          <input className="border p-2 w-full" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required />
        </div>
        <div>
          <label className="block mb-1">Username</label>
          <input className="border p-2 w-full" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
        </div>
        <div>
          <label className="block mb-1">Email</label>
          <input type="email" className="border p-2 w-full" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
        </div>
        <div>
          <label className="block mb-1">Senha Inicial</label>
          <input type="password" className="border p-2 w-full" value={formData.senhaInicial} onChange={e => setFormData({...formData, senhaInicial: e.target.value})} required />
        </div>
        <div>
          <label className="block mb-1">Perfil</label>
          <select className="border p-2 w-full" value={formData.perfil} onChange={e => setFormData({...formData, perfil: e.target.value})}>
            <option>ADMIN</option>
            <option>GERENTE</option>
            <option>VENDEDOR</option>
            <option>CAIXA</option>
            <option>ESTOQUE</option>
          </select>
        </div>
        <div>
          <label className="block mb-1">Status</label>
          <select className="border p-2 w-full" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Criar Usuário
        </button>
      </form>
    </div>
  )
}
