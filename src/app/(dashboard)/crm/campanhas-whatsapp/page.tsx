"use client"

import React, { useState } from "react"
import { MessageSquare, Send, Copy, Info } from "lucide-react"
import { ReportHeader } from "@/components/reports/report-header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

const TEMPLATES = [
  {
    id: 1,
    name: "Parabéns ao Filho(a)",
    content: "Oi {nome_mae}, tudo bem? Aqui é da Trupe Kids! Passando pra desejar um Feliz Aniversário pro {nome_filho} que está completando {idade} aninhos! 🎉 Preparamos um presente especial: use o cupom {cupom} e ganhe 15% OFF na próxima comprinha dele!"
  },
  {
    id: 2,
    name: "Nova Coleção / Tamanho",
    content: "Oi {nome_mae}! Chegou coleção nova na Trupe Kids e lembrei do {nome_filho}! Recebemos peças lindas no tamanho {tamanho} que ele(a) usa. Quer que eu te mande umas fotos sem compromisso? 👗👕"
  },
  {
    id: 3,
    name: "Aviso de Saldo (Vale-Troca)",
    content: "Olá {nome_mae}! Tudo bem? Vi aqui no nosso sistema que você tem um crédito/saldo de {saldo} guardadinho com a gente. Que tal aproveitar pra escolher um look novo pro {nome_filho}? Me chama se quiser ver novidades!"
  }
]

export default function CampanhasWhatsAppPage() {
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [vars, setVars] = useState({
    nome_mae: "",
    nome_filho: "",
    idade: "",
    cupom: "NIVER15",
    tamanho: "",
    saldo: ""
  })

  const handleTemplateClick = (content: string) => {
    setMessage(content)
  }

  const handleVarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVars({ ...vars, [e.target.name]: e.target.value })
  }

  const getProcessedMessage = () => {
    let finalMsg = message
    finalMsg = finalMsg.replace(/{nome_mae}/g, vars.nome_mae || "[Nome da Mãe]")
    finalMsg = finalMsg.replace(/{nome_filho}/g, vars.nome_filho || "[Nome do Filho]")
    finalMsg = finalMsg.replace(/{idade}/g, vars.idade || "[Idade]")
    finalMsg = finalMsg.replace(/{cupom}/g, vars.cupom || "[Cupom]")
    finalMsg = finalMsg.replace(/{tamanho}/g, vars.tamanho || "[Tamanho]")
    finalMsg = finalMsg.replace(/{saldo}/g, vars.saldo || "[Saldo]")
    return finalMsg
  }

  const handleSend = () => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      toast({ variant: "destructive", title: "Número inválido", description: "Digite um WhatsApp válido com DDD." })
      return
    }
    const finalMessage = encodeURIComponent(getProcessedMessage())
    window.open(`https://wa.me/55${cleanPhone}?text=${finalMessage}`, '_blank')
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getProcessedMessage())
    toast({ title: "Copiado", description: "Mensagem copiada para a área de transferência!" })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <ReportHeader 
        title="Campanhas WhatsApp" 
        icon={MessageSquare} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Templates e Variáveis */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Templates Prontos
            </h3>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateClick(t.content)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                >
                  <span className="block font-medium text-slate-700">{t.name}</span>
                  <span className="block text-xs text-slate-500 truncate mt-1">{t.content}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">Variáveis de Preenchimento</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nome da Mãe</label>
                <Input name="nome_mae" value={vars.nome_mae} onChange={handleVarChange} className="h-8" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nome do Filho(a)</label>
                <Input name="nome_filho" value={vars.nome_filho} onChange={handleVarChange} className="h-8" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Idade</label>
                <Input name="idade" value={vars.idade} onChange={handleVarChange} className="h-8" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Tamanho</label>
                <Input name="tamanho" value={vars.tamanho} onChange={handleVarChange} className="h-8" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Cupom</label>
                <Input name="cupom" value={vars.cupom} onChange={handleVarChange} className="h-8" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Saldo (R$)</label>
                <Input name="saldo" value={vars.saldo} onChange={handleVarChange} className="h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Editor de Mensagem */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            
            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-800 block mb-2">1. Número do Cliente (WhatsApp)</label>
              <Input 
                placeholder="Ex: 11999999999" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                className="max-w-xs"
              />
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-slate-800">2. Mensagem</label>
                <button onClick={copyToClipboard} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copiar Texto
                </button>
              </div>
              <Textarea 
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite sua mensagem ou escolha um template ao lado..."
                className="resize-none font-sans"
              />
            </div>

            <div className="bg-slate-100 p-4 rounded-lg mb-6">
              <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider flex items-center gap-1">
                <Info className="h-3 w-3" /> Pré-visualização Final
              </h4>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {getProcessedMessage() || <span className="text-slate-400 italic">Sua mensagem aparecerá aqui...</span>}
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSend} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                <Send className="h-4 w-4" />
                Disparar WhatsApp
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
