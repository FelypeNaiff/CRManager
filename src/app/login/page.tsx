"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Store, Loader2, LogIn } from "lucide-react"
import { useAuth, useFirestore } from "@/firebase"
import { signInAnonymously } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Para o protótipo, usamos login anônimo para facilitar o acesso
      const userCredential = await signInAnonymously(auth)
      const user = userCredential.user

      // Garantimos que o perfil de vendedor exista para satisfazer as Security Rules (isStaff)
      await setDoc(doc(db, "vendedores", user.uid), {
        id: user.uid,
        nome: "Vendedor Padrão",
        email: "vendedor@crmanager.com",
        comissao: 5,
        comissaoTipo: "porcentagem",
        ativo: true
      }, { merge: true })

      toast({
        title: "Bem-vindo!",
        description: "Acesso autorizado ao CRManager.",
      })
      
      router.push("/dashboard")
    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erro no acesso",
        description: "Não foi possível validar suas credenciais.",
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
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="admin@loja.com" defaultValue="vendedor@crmanager.com" disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" defaultValue="******" disabled />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full text-lg h-12" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Acessando...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" /> Entrar no Sistema
                </>
              )}
            </Button>
          </CardFooter>
        </form>
        <div className="p-6 pt-0 text-center">
          <p className="text-xs text-muted-foreground">
            Acesso demonstrativo: Clique em "Entrar" para criar um perfil de vendedor e acessar o dashboard.
          </p>
        </div>
      </Card>
    </div>
  )
}
