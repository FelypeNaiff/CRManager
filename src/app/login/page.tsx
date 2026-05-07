"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Store, Loader2, LogIn } from "lucide-react"
import { useAuth } from "@/firebase"
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { toast } from "@/hooks/use-toast"

const ALLOWED_EMAILS = [
  'felypenaiff01@gmail.com',
  'trupekidsmcp@gmail.com'
]

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const auth = useAuth()
  const router = useRouter()

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      if (user.email && ALLOWED_EMAILS.includes(user.email)) {
        toast({
          title: "Bem-vindo!",
          description: "Acesso administrativo autorizado.",
        })
        router.push("/selecionar-perfil")
      } else {
        await signOut(auth)
        toast({
          variant: "destructive",
          title: "Acesso Negado",
          description: "Este e-mail não tem permissão de administrador.",
        })
      }
    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erro no acesso",
        description: "Credenciais inválidas. Verifique seu e-mail e senha.",
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
          <CardTitle className="text-2xl font-bold tracking-tight">CRManager</CardTitle>
          <CardDescription>
            Sistema de Gestão de Varejo e Moda Infantil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="text-center text-sm text-muted-foreground mb-4">
              Acesso restrito a administradores. Informe suas credenciais.
            </div>
            <div className="grid gap-2 text-left">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 text-left">
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
              className="w-full text-lg h-12 gap-2 mt-2" 
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
              {isLoading ? "Acessando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <div className="p-6 pt-0 text-center">
          <p className="text-xs text-muted-foreground">
            Apenas e-mails autorizados terão permissão para prosseguir.
          </p>
        </div>
      </Card>
    </div>
  )
}
