"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Megaphone, 
  Sparkles, 
  Send, 
  Users, 
  Target,
  Plus,
  BarChart3,
  Clock,
  Loader2,
  AlertCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { generateMarketingCampaignContent } from "@/ai/flows/marketing-campaign-content-generator"
import { toast } from "@/hooks/use-toast"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"

export default function CampanhasPage() {
  const [targetAudience, setTargetAudience] = useState("")
  const [objective, setObjective] = useState("")
  const [generatedContent, setGeneratedContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const db = useFirestore()

  const campanhasQuery = useMemoFirebase(() => db ? collection(db, "campanhas_marketing") : null, [db])
  const { data: campaigns, isLoading, error } = useCollection(campanhasQuery)

  const handleGenerateContent = async () => {
    if (!targetAudience || !objective) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "Informe o público-alvo e o objetivo da campanha."
      })
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateMarketingCampaignContent({
        targetAudience,
        campaignObjective: objective
      })
      setGeneratedContent(result.generatedContent)
      toast({
        title: "Conteúdo gerado!",
        description: "A IA criou uma sugestão de mensagem para sua campanha."
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na geração",
        description: "Ocorreu um problema ao gerar o conteúdo com IA."
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Marketing</h1>
          <p className="text-muted-foreground">Crie campanhas inteligentes e automatize sua comunicação.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Nova Campanha
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Campanhas Recentes
          </h2>
          
          {error ? (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm flex-1">
                <h3 className="font-semibold text-base">Erro ao carregar campanhas</h3>
                <p>{(error as any).message || "Acesso Negado."}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="text-center py-10 border rounded-xl bg-muted/5">
              <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>
            </div>
          ) : (
            campaigns.map((camp: any) => (
              <Card key={camp.id} className="shadow-sm border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold">{camp.nome}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {camp.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {camp.canal}</span>
                    <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {camp.totalEnviados || 0}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <Button variant="outline" className="w-full">Ver todas as campanhas</Button>
        </div>

        <Card className="lg:col-span-2 shadow-md border-primary/20 overflow-hidden">
          <CardHeader className="bg-primary/5 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Assistente de Marketing IA</CardTitle>
                <CardDescription>Use nossa inteligência artificial para criar mensagens persuasivas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Público-Alvo
                </label>
                <Input 
                  placeholder="Ex: Mães de recém-nascidos..." 
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" /> Objetivo
                </label>
                <Input 
                  placeholder="Ex: Oferecer cupom de 15%..." 
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Conteúdo da Mensagem</label>
              <Textarea 
                placeholder="O conteúdo gerado aparecerá aqui..." 
                className="min-h-[150px] leading-relaxed"
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 p-4 flex justify-between">
            <p className="text-xs text-muted-foreground max-w-xs">
              A IA gera uma sugestão baseada no seu público e objetivo. Revise antes de enviar.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleGenerateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Gerar com IA
                  </>
                )}
              </Button>
              <Button className="gap-2" disabled={!generatedContent || isGenerating}>
                <Send className="h-4 w-4" /> Criar Campanha
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
