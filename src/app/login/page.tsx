"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Store, Loader2, LogIn } from "lucide-react"
import { useAuth } from "@/firebase"
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth"
import { toast } from "@/hooks/use-toast"

const ALLOWED_EMAILS = [
  'felypenaiff01@gmail.com',
  'trupekidsmcp@gmail.com'
]

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const auth = useAuth()
  const router = useRouter()

  const handleLogin = async () => {
    setIsLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
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
        description: "Não foi possível realizar o login com Google.",
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
        <CardContent className="grid gap-4">
          <div className="text-center text-sm text-muted-foreground mb-4">
            O acesso inicial ao sistema é restrito apenas aos administradores via conta Google.
          </div>
          <Button 
            className="w-full text-lg h-12 gap-2" 
            variant="outline"
            onClick={handleLogin} 
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.79 15.73 17.57V20.34H19.29C21.37 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
                <path d="M12 23C14.97 23 17.46 22.02 19.29 20.34L15.73 17.57C14.74 18.24 13.48 18.64 12 18.64C9.14 18.64 6.72 16.71 5.86 14.13H2.18V16.98C4.01 20.61 7.74 23 12 23Z" fill="#34A853"/>
                <path d="M5.86 14.13C5.64 13.47 5.51 12.75 5.51 12C5.51 11.25 5.64 10.53 5.86 9.87V7.02H2.18C1.43 8.52 1 10.21 1 12C1 13.79 1.43 15.48 2.18 16.98L5.86 14.13Z" fill="#FBBC05"/>
                <path d="M12 5.36C13.62 5.36 15.07 5.92 16.21 7.01L19.38 3.84C17.46 2.05 14.97 1 12 1C7.74 1 4.01 3.39 2.18 7.02L5.86 9.87C6.72 7.29 9.14 5.36 12 5.36Z" fill="#EA4335"/>
              </svg>
            )}
            {isLoading ? "Acessando..." : "Entrar com Google"}
          </Button>
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
