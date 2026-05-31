"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Store, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase" // assuming supabase client exists

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const contentType = res.headers.get("content-type")
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json()
        
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Credenciais inválidas.')
        }

        toast({
          title: "Bem-vindo!",
          description: "Login efetuado com sucesso.",
        })

        router.push(data.redirectTo || "/dashboard")
      } else {
        const textError = await res.text()
        console.error("Resposta não-JSON da API:", textError)
        throw new Error('Erro de comunicação com o servidor.')
      }

    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: error.message || "Não foi possível autenticar.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!username) {
      toast({
        variant: "destructive",
        title: "Atenção",
        description: "Digite seu username para recuperar a senha.",
      })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/get-email-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      const data = await res.json()

      if (!res.ok || !data.email) throw new Error('Usuário inválido.')

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw new Error('Erro ao enviar e-mail de recuperação.')

      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível enviar o e-mail.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <Store className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">NEEX</CardTitle>
          <CardDescription>
            Sistema de Gestão de Vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Usuário</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="felypenaiff" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit"
              className="w-full text-base h-12 mt-4" 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Entrar"
              )}
            </Button>
            
            <Button 
              type="button" 
              variant="link" 
              className="text-sm text-muted-foreground w-full mt-2"
              onClick={handleResetPassword}
              disabled={isLoading}
            >
              Esqueci minha senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
