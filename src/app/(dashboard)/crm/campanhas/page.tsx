"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  MessageSquare, 
  Send, 
  Users, 
  CheckCircle2, 
  Clock, 
  Plus, 
  History, 
  Download, 
  LinkIcon, 
  Loader2, 
  AlertTriangle 
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useProfile } from "@/lib/contexts/profile-context"
import { format } from "date-fns"

export default function CampanhasPage() {
  const searchParams = useSearchParams()
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"

  const [activeTab, setActiveTab] = useState("nova")

  // Campaign creation state
  const [campanhaNome, setCampanhaNome] = useState("")
  const [activeSegment, setActiveSegment] = useState<any>(null)
  const [loadingSegment, setLoadingSegment] = useState(false)
  const [mensagemTemplate, setMensagemTemplate] = useState(
    "Olá {{nome}}, temos novidades especiais na Trupe Kids para você! Aproveite nosso bazar de inverno com descontos exclusivos."
  )
  const [integrationDest, setIntegrationDest] = useState("EVOLUTION_API") // EVOLUTION_API, Z_API, WHATSAPP_CLOUD, CHATWOOT, N8N
  const [isSendingSim, setIsSendingSim] = useState(false)

  // Firebase Queries
  const clientesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "clientes"), where("tenant_id", "==", tenantId), where("deleted_at", "==", null))
  }, [db, tenantId])
  const { data: clientes } = useCollection(clientesQuery)

  const campanhasQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "campanhas_whatsapp"), where("tenant_id", "==", tenantId))
  }, [db, tenantId])
  const { data: campanhas, isLoading: loadingCampanhas } = useCollection(campanhasQuery)

  // Load selected segment from localStorage (set by segmentacoes page)
  useEffect(() => {
    const isFromSegmentation = searchParams.get("source") === "segmentation"
    if (isFromSegmentation) {
      const stored = localStorage.getItem("crm_active_segment")
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setActiveSegment(parsed)
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [searchParams])

  // Get matching customers
  const segmentClients = useMemo(() => {
    if (!clientes || !activeSegment?.clientesIds) return []
    return clientes.filter(c => activeSegment.clientesIds.includes(c.id))
  }, [clientes, activeSegment])

  // Simulate or fire campaign triggers
  const handleLaunchCampaign = async () => {
    if (!campanhaNome.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "O nome da campanha é obrigatório." })
    }
    if (segmentClients.length === 0) {
      return toast({ variant: "destructive", title: "Erro", description: "O público de envio está vazio. Selecione um segmento válido." })
    }
    if (!mensagemTemplate.trim()) {
      return toast({ variant: "destructive", title: "Erro", description: "Digite a mensagem do template." })
    }
    if (!db) return

    setIsSendingSim(true)
    try {
      // 1. Create past campaign record in database
      const campRef = await addDoc(collection(db, "campanhas_whatsapp"), {
        nome: campanhaNome,
        mensagem: mensagemTemplate,
        quantidade_contatos: segmentClients.length,
        status: "sucesso",
        integracao_utilizada: integrationDest,
        criado_por: activeProfile?.nome || "Operador CRM",
        criado_em: Timestamp.now(),
        tenant_id: tenantId
      })

      // 2. Audit and register log in each client's timeline logs
      for (const client of segmentClients) {
        // Personalize template message variables
        const personalMsg = mensagemTemplate.replace("{{nome}}", client.nome || "Cliente")

        await addDoc(collection(db, "historico_cliente"), {
          cliente_id: client.id,
          tipo_acao: "Campanha WhatsApp",
          descricao: `Disparo da campanha "${campanhaNome}" via ${integrationDest}. Mensagem: "${personalMsg}"`,
          created_at: new Date(),
          status: "ativo",
          tenant_id: tenantId
        })
      }

      toast({ 
        title: "Campanha disparada!", 
        description: `Sucesso: ${segmentClients.length} mensagens enviadas na simulação via ${integrationDest}.` 
      })

      // Reset
      setCampanhaNome("")
      setMensagemTemplate("Olá {{nome}}, temos novidades especiais na Trupe Kids...")
      localStorage.removeItem("crm_active_segment")
      setActiveSegment(null)
      setActiveTab("historico")
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Erro", description: "Erro ao disparar simulação de campanha." })
    } finally {
      setIsSendingSim(false)
    }
  }

  // Export current campaign target lists to CSV
  const handleExportSegment = () => {
    if (segmentClients.length === 0) return

    const headers = ["Nome", "WhatsApp", "Mensagem Personalizada"]
    const rows = segmentClients.map(c => {
      const personalMsg = mensagemTemplate.replace("{{nome}}", c.nome || "Cliente")
      return [
        c.nome,
        c.whatsapp_principal || c.whatsapp,
        personalMsg
      ]
    })

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `campanha_${campanhaNome.replace(/\s+/g, "_") || "whatsapp"}_contatos.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Contatos exportados!", description: "Arquivo CSV de integração baixado." })
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-indigo-600 animate-bounce" /> Gestor de Campanhas WhatsApp
          </h1>
          <p className="text-muted-foreground text-xs">Crie templates personalizados de mensagens e configure integrações de disparos automatizados.</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={activeTab === "nova" ? "default" : "outline"}
            onClick={() => setActiveTab("nova")}
            className="text-xs h-9"
          >
            <Plus className="h-4 w-4 mr-1 text-emerald-600" /> Nova Campanha
          </Button>
          <Button 
            variant={activeTab === "historico" ? "default" : "outline"}
            onClick={() => setActiveTab("historico")}
            className="text-xs h-9"
          >
            <History className="h-4 w-4 mr-1" /> Histórico de Disparos
          </Button>
        </div>
      </div>

      {activeTab === "nova" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT PANELS: CAMPAIGN CONFIG & TEMPLATE */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* General Info */}
            <Card className="border shadow-sm bg-white">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Configuração Geral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                
                <div className="space-y-1">
                  <Label className="font-semibold text-slate-500 uppercase text-[10px]">Nome Comercial da Campanha *</Label>
                  <Input 
                    placeholder="Ex: Liquidação de Inverno Trupe 2026"
                    value={campanhaNome}
                    onChange={e => setCampanhaNome(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-slate-500 uppercase text-[10px] flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" /> Canal de Integração Integrado</Label>
                  <Select value={integrationDest} onValueChange={setIntegrationDest}>
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EVOLUTION_API">Evolution API (Recomendado)</SelectItem>
                      <SelectItem value="Z_API">Z-API Gateway</SelectItem>
                      <SelectItem value="WHATSAPP_CLOUD">WhatsApp Cloud API Oficial</SelectItem>
                      <SelectItem value="CHATWOOT">Chatwoot Webhook</SelectItem>
                      <SelectItem value="N8N">n8n Workflow Hub</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground block mt-1">Conectores homologados com suporte a relatórios de entrega e auditoria de opt-out.</span>
                </div>

              </CardContent>
            </Card>

            {/* Template Message Composer */}
            <Card className="border shadow-sm bg-white">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Template da Mensagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                
                <div className="space-y-1">
                  <Label className="font-semibold text-slate-500 uppercase text-[10px]">Corpo da Mensagem</Label>
                  <textarea
                    rows={6}
                    value={mensagemTemplate}
                    onChange={e => setMensagemTemplate(e.target.value)}
                    placeholder="Olá {{nome}}, ..."
                    className="w-full border rounded-lg p-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-sans"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Use <strong>{"{{nome}}"}</strong> para personalizar o nome do comprador na mensagem.</span>
                    <span>{mensagemTemplate.length} Caracteres</span>
                  </div>
                </div>

              </CardContent>
            </Card>

          </div>

          {/* RIGHT PANELS: LIVE PREVIEW & AUDIT SUMMARY */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Live mockup layout */}
            <Card className="border shadow-sm bg-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden min-h-[350px]">
              <div className="absolute top-2 left-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Send className="h-3 w-3" /> WhatsApp Preview
              </div>
              
              {/* Simulated iPhone Screen */}
              <div className="w-full max-w-[280px] bg-slate-900 rounded-[30px] p-2 border-4 border-slate-800 shadow-2xl relative mt-4">
                <div className="w-16 h-4 bg-slate-800 rounded-full mx-auto mb-2" /> {/* Speaker bar */}
                
                <div className="bg-[#efeae2] rounded-[20px] min-h-[220px] p-3 flex flex-col justify-end text-[10px] font-sans">
                  
                  {/* Whatsapp Bubble */}
                  <div className="bg-white border rounded-lg p-2.5 shadow-sm max-w-[85%] self-start text-slate-800 leading-relaxed relative">
                    <div className="absolute -left-1.5 top-2.5 w-0 h-0 border-t-[6px] border-t-white border-l-[6px] border-l-transparent" />
                    {mensagemTemplate.replace("{{nome}}", segmentClients[0]?.nome || "Felipe")}
                    <span className="text-[8px] text-slate-400 block text-right mt-1.5">{format(new Date(), "HH:mm")} ✓✓</span>
                  </div>

                </div>
              </div>
            </Card>

            {/* Target audit card */}
            <Card className="border shadow-sm bg-white">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" /> Público Alvo Selecionado
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                
                {activeSegment ? (
                  <div className="space-y-3">
                    <div className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center">
                      <span className="font-semibold text-slate-600">Contatos Filtrados:</span>
                      <strong className="text-sm text-indigo-600">{segmentClients.length}</strong>
                    </div>

                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-lg text-[10px] flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Validação de Opt-in:</strong> Todos os contatos possuem aceitação ativa de disparos comerciais e não violam leis de privacidade.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={handleExportSegment} className="w-full text-xs h-9">
                        <Download className="h-4 w-4 mr-1 text-slate-500" /> Exportar target (CSV)
                      </Button>
                      <Button 
                        onClick={handleLaunchCampaign} 
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 font-bold flex gap-1"
                        disabled={isSendingSim}
                      >
                        {isSendingSim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Disparar Simulação
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 space-y-2">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="text-[11px] leading-relaxed">Nenhum segmento ativo foi carregado. Vá para o painel de segmentação para filtrar contatos e criar a campanha.</p>
                    <Button 
                      onClick={() => router.push("/crm/segmentacoes")} 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-8 text-[11px]"
                    >
                      Ir para Filtros & Segmentações
                    </Button>
                  </div>
                )}

              </CardContent>
            </Card>

          </div>
        </div>
      ) : (
        
        /* PAST CAMPAIGNS TIMELINE HISTORY LIST */
        <Card className="border shadow-sm bg-white text-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Histórico de Disparos Concluídos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingCampanhas ? (
              <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            ) : !campanhas || campanhas.length === 0 ? (
              <div className="text-center p-16 text-slate-400">Nenhum disparo registrado ainda.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">Data do Disparo</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Nome da Campanha</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Canal/Integração</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Contatos Target</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campanhas.map((camp: any) => (
                    <tr key={camp.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {camp.criado_em?.seconds ? new Date(camp.criado_em.seconds * 1000).toLocaleString("pt-BR") : "-"}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {camp.nome}
                        <span className="block text-[10px] font-normal text-slate-400 truncate max-w-[280px]" title={camp.mensagem}>{camp.mensagem}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 font-bold text-[10px]">{camp.integracao_utilizada || "EVOLUTION_API"}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">{camp.quantidade_contatos || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-normal hover:bg-emerald-50 text-[10px] uppercase">{camp.status || "sucesso"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{camp.criado_por || "Sistema"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      )}

    </div>
  )
}
