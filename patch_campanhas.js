const fs = require('fs');

const content = `"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { getCustomers, listCampaigns, createCampaignAction } from "@/lib/crm/actions"
import { format } from "date-fns"

export default function CampanhasPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState("nova")

  // Campaign creation state
  const [campanhaNome, setCampanhaNome] = useState("")
  const [activeSegment, setActiveSegment] = useState<any>(null)
  const [mensagemTemplate, setMensagemTemplate] = useState(
    "Olá {{nome}}, temos novidades especiais na Trupe Kids para você! Aproveite nosso bazar de inverno com descontos exclusivos."
  )
  const [integrationDest, setIntegrationDest] = useState("EVOLUTION_API")
  const [isSendingSim, setIsSendingSim] = useState(false)

  const [clientes, setClientes] = useState<any[]>([])
  const [campanhas, setCampanhas] = useState<any[]>([])
  const [loadingCampanhas, setLoadingCampanhas] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const res = await getCustomers()
      if (res.success && res.data) {
        setClientes(res.data)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    async function fetchCampaigns() {
      if (activeTab !== "historico") return
      setLoadingCampanhas(true)
      const res = await listCampaigns()
      if (res.success && res.data) {
        setCampanhas(res.data)
      }
      setLoadingCampanhas(false)
    }
    fetchCampaigns()
  }, [activeTab])

  useEffect(() => {
    const isFromSegmentation = searchParams?.get("source") === "segmentation"
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

  const segmentClients = useMemo(() => {
    if (!clientes || !activeSegment?.clientesIds) return []
    return clientes.filter(c => activeSegment.clientesIds.includes(c.id))
  }, [clientes, activeSegment])

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

    setIsSendingSim(true)
    try {
      const res = await createCampaignAction({
        name: campanhaNome,
        message: mensagemTemplate,
        integration: integrationDest,
        clients: segmentClients.map(c => c.id)
      })

      if (res.success) {
        toast({ 
          title: "Campanha disparada!", 
          description: \`Sucesso: \${segmentClients.length} mensagens enviadas na simulação via \${integrationDest}.\` 
        })
        setCampanhaNome("")
        setMensagemTemplate("Olá {{nome}}, temos novidades especiais na Trupe Kids...")
        localStorage.removeItem("crm_active_segment")
        setActiveSegment(null)
        setActiveTab("historico")
      } else {
        toast({ variant: "destructive", title: "Erro", description: res.error })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: "Erro ao disparar simulação de campanha." })
    } finally {
      setIsSendingSim(false)
    }
  }

  const handleExportSegment = () => {
    if (segmentClients.length === 0) return

    const headers = ["Nome", "WhatsApp", "Mensagem Personalizada"]
    const rows = segmentClients.map(c => {
      const personalMsg = mensagemTemplate.replace("{{nome}}", c.name || "Cliente")
      return [
        c.name,
        c.phone,
        personalMsg
      ]
    })

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => \`"\${String(val).replace(/"/g, '""')}"\`).join(","))].join("\\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", \`publico_campanha_\${format(new Date(), "yyyy-MM-dd")}.csv\`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Planilha exportada!", description: "Arquivo CSV preparado para disparo manual." })
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-indigo-600" /> Disparos & Campanhas
          </h1>
          <p className="text-muted-foreground text-xs">Crie campanhas para o público segmentado via integrações WhatsApp.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("nova")}
          className={\`flex items-center gap-1.5 pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all \${
            activeTab === "nova" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }\`}
        >
          <Plus className="h-4 w-4" /> Nova Campanha
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={\`flex items-center gap-1.5 pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all \${
            activeTab === "historico" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }\`}
        >
          <History className="h-4 w-4" /> Histórico de Disparos
        </button>
      </div>

      {activeTab === "nova" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border shadow-sm bg-white">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Send className="h-4 w-4 text-indigo-500" /> Configuração da Campanha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-600 text-xs">Nome Interno da Campanha</Label>
                  <Input 
                    placeholder="Ex: Oferta de Inverno VIP" 
                    value={campanhaNome}
                    onChange={e => setCampanhaNome(e.target.value)}
                    className="h-10 text-xs bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-slate-600 text-xs">Público Alvo (Segmento)</Label>
                    <Button variant="link" className="text-[10px] h-auto p-0 text-indigo-600" onClick={() => router.push("/crm/segmentacoes")}>
                      Alterar Público no Motor de Filtros
                    </Button>
                  </div>
                  
                  {activeSegment ? (
                    <div className="p-3 border rounded-lg bg-indigo-50/50 border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Segmentação Ativa Carregada</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{activeSegment.clientesIds?.length || 0} contatos elegíveis para disparo.</p>
                        </div>
                      </div>
                      <Badge className="bg-indigo-600 hover:bg-indigo-700 font-mono">
                        {segmentClients.length} contatos
                      </Badge>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed rounded-lg bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-2">
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                      <p className="text-xs font-semibold text-slate-700">Nenhum público segmentado atrelado.</p>
                      <p className="text-[10px] text-slate-500 max-w-xs">Acesse o Motor de Segmentações para filtrar a base antes de criar a campanha.</p>
                      <Button onClick={() => router.push("/crm/segmentacoes")} className="h-8 text-xs mt-2" variant="outline">
                        Ir para Filtros
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label className="font-semibold text-slate-600 text-xs flex items-center gap-2">
                    Mensagem (Template) 
                    <Badge variant="outline" className="text-[9px] text-slate-400 font-mono">Suporta {'{{nome}}'}</Badge>
                  </Label>
                  <textarea 
                    className="w-full min-h-[120px] p-3 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Digite a mensagem com variáveis..."
                    value={mensagemTemplate}
                    onChange={e => setMensagemTemplate(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 italic">
                    Dica: Mantenha as mensagens curtas e objetivas para evitar bloqueios por spam no WhatsApp.
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="border shadow-sm bg-white">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-emerald-500" /> API de Disparo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-600 text-xs">Integração Ativa</Label>
                  <Select value={integrationDest} onValueChange={setIntegrationDest}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EVOLUTION_API">Evolution API (Node)</SelectItem>
                      <SelectItem value="Z_API">Z-API (Oficial)</SelectItem>
                      <SelectItem value="WHATSAPP_CLOUD">WhatsApp Cloud API (Meta)</SelectItem>
                      <SelectItem value="N8N">Webhook N8N Automations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border text-[10px] space-y-1.5 text-slate-500">
                  <p><strong className="text-slate-700">Canal:</strong> {integrationDest}</p>
                  <p><strong className="text-slate-700">Status da API:</strong> <span className="text-emerald-600 font-bold">Conectado (Simulado)</span></p>
                  <p><strong className="text-slate-700">Custo estimado:</strong> R$ {(segmentClients.length * 0.05).toFixed(2)}</p>
                </div>

                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 gap-2"
                  onClick={handleLaunchCampaign}
                  disabled={isSendingSim || segmentClients.length === 0}
                >
                  {isSendingSim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirmar e Disparar
                </Button>

                <Button 
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold h-10 gap-2 mt-2"
                  onClick={handleExportSegment}
                  disabled={segmentClients.length === 0}
                >
                  <Download className="h-4 w-4" /> Exportar Planilha (Envio Manual)
                </Button>

              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-amber-50/50 border-amber-200">
              <CardContent className="p-4 text-xs text-amber-800 space-y-2">
                <strong className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Atenção às Políticas do WhatsApp</strong>
                <p>Campanhas em massa sem opt-in prévio (Aceite de Marketing) podem banir o número do remetente permanentemente.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Histórico e Relatórios de Disparo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCampanhas ? (
                <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
              ) : campanhas.length === 0 ? (
                <div className="text-center p-20 text-muted-foreground text-xs">
                  Nenhuma campanha disparada ainda.
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-600">Cliente / Destino</TableHead>
                      <TableHead className="font-semibold text-slate-600">Descrição / Disparo</TableHead>
                      <TableHead className="font-semibold text-slate-600">Data e Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanhas.map((camp: any) => (
                      <TableRow key={camp.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-700">{camp.cliente}</TableCell>
                        <TableCell className="text-slate-600">
                          {camp.description}
                        </TableCell>
                        <TableCell className="text-slate-500 whitespace-nowrap">
                          {new Date(camp.createdAt).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
`;

fs.writeFileSync('src/app/(dashboard)/crm/campanhas/page.tsx', content, 'utf8');
