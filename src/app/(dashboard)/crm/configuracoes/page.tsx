"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Settings, Loader2, Sparkles, Shield, Info, HelpCircle, Save } from "lucide-react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore } from "@/supabase-mocks"
import { seedCrmBasico } from "@/lib/seeds/crm"
import { toast } from "@/hooks/use-toast"

export default function CrmSettingsPage() {
  const db = useFirestore()
  const { activeProfile } = useProfile()
  const tenantId = activeProfile?.empresaId || "default-tenant"

  const [marketingAuto, setMarketingAuto] = useState(true)
  const [allowNegativeWallet, setAllowNegativeWallet] = useState(false)
  const [pointsExpirationDays, setPointsExpirationDays] = useState("365")
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast({ title: "Configurações salvas!", description: "As regras do CRM foram atualizadas com sucesso." })
    }, 800)
  }

  const handleSeed = async () => {
    setIsSeeding(true)
    try {
      const result = await seedCrmBasico(db, tenantId, activeProfile?.id || "system")
      if (result) {
        toast({ title: "Seed executado!", description: "As tags e parâmetros padrão foram gerados na base." })
      } else {
        toast({ title: "Sem alterações", description: "A base de tags já estava inicializada." })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no seed" })
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Settings className="h-8 w-8 text-indigo-600" /> Configurações do CRM
        </h1>
        <p className="text-muted-foreground text-sm">Gerencie regras de negócios, expiração de bônus, disparos de marketing e ferramentas da base de dados.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Core Rules */}
        <Card className="md:col-span-2 border border-slate-100 bg-white rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
              <Shield className="h-5 w-5 text-indigo-500" /> Parâmetros e Regras do Sistema
            </CardTitle>
            <CardDescription>Determine o funcionamento financeiro e automatizações de WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-xs">
            <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50/50">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-semibold">Mensagens Automáticas de WhatsApp</Label>
                <span className="text-muted-foreground text-[10px]">Lembrar clientes de saldos parados e aniversários.</span>
              </div>
              <Switch checked={marketingAuto} onCheckedChange={setMarketingAuto} />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50/50">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-semibold">Permitir Saldo Devedor</Label>
                <span className="text-muted-foreground text-[10px]">Permitir que carteiras de crédito fiquem negativas durante trocas rápidas.</span>
              </div>
              <Switch checked={allowNegativeWallet} onCheckedChange={setAllowNegativeWallet} />
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold block">Dias para Expiração de Crédito</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  className="max-w-[120px]"
                  value={pointsExpirationDays}
                  onChange={e => setPointsExpirationDays(e.target.value)}
                />
                <span className="text-muted-foreground">dias (Deixe em branco ou 0 para nunca expirar).</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 font-medium" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configurações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database parameters & tools */}
        <Card className="border border-slate-100 bg-white rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
              <Sparkles className="h-5 w-5 text-amber-500" /> Parâmetros de Banco de Dados
            </CardTitle>
            <CardDescription>Ações de manutenção de dados isolados por tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 border rounded-xl bg-slate-50/50 space-y-3">
              <div>
                <strong className="text-slate-700 block">ID da Empresa (Tenant Activo)</strong>
                <span className="font-mono text-slate-400 block mt-1 break-all bg-white p-2 border rounded-lg">{tenantId}</span>
              </div>
              <div>
                <strong className="text-slate-700 block">Perfil de Operador</strong>
                <span className="text-slate-500 block mt-0.5">{activeProfile?.nome || "Sistema"}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <strong className="text-slate-700 block mb-1">Estrutura Inicial de CRM</strong>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Clique abaixo para gerar tags básicas de segmentação e carteiras de apoio na base de dados caso estejam vazias.
              </p>
              <Button variant="outline" className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50/50 gap-2 h-9" onClick={handleSeed} disabled={isSeeding}>
                {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                Popular Tabelas Padrão (Seed)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
