"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("Global Error Caught:", error)
  }, [error])

  const isPermissionError = error.message?.includes("Acesso negado") || error.name === "FirestorePermissionError"

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/20 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-destructive/10 w-16 h-16 flex items-center justify-center rounded-full mb-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">
            {isPermissionError ? "Acesso Negado" : "Ops! Algo deu errado"}
          </CardTitle>
          <CardDescription>
            {isPermissionError 
              ? "Você não tem permissão para acessar esta página ou visualizar estes dados." 
              : "Ocorreu um erro inesperado na aplicação."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => router.push("/dashboard")} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para o Início
          </Button>
          {!isPermissionError && (
            <Button variant="outline" onClick={() => reset()} className="w-full">
              Tentar Nãovamente
            </Button>
          )}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg text-xs font-mono overflow-auto max-h-32 text-left">
              <p className="text-destructive font-semibold mb-1">{error.name}: {error.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
