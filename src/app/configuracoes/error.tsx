"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ConfiguracoesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("Erro em Configurações:", error)
  }, [error])

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/20 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-destructive/10 w-16 h-16 flex items-center justify-center rounded-full mb-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Falha ao carregar Configurações</CardTitle>
          <CardDescription>
            Ocorreu um erro ao carregar o módulo de configurações. Tente recarregar ou volte ao dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => router.push("/dashboard")} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
          </Button>
          <Button variant="outline" onClick={() => reset()} className="w-full">
            Recarregar
          </Button>
          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-xs font-mono overflow-auto max-h-32 text-left">
            <p className="text-destructive font-semibold mb-1">{error.name}: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
