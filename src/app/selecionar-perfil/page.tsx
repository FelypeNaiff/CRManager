"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PREDEFINED_PROFILES, useProfile, Profile } from "@/lib/contexts/profile-context"
import { useUser, useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserCircle2, ArrowLeft, LogOut, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function SelecionarPerfilPage() {
  const { user, isUserLoading } = useUser()
  const { loginProfile, activeProfile } = useProfile()
  const auth = useAuth()
  const router = useRouter()
  
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [pin, setPin] = useState("")
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Redirect to login if no google user
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  // Redirect to dashboard if already has a profile selected
  useEffect(() => {
    if (activeProfile && user) {
      router.push("/dashboard")
    }
  }, [activeProfile, user, router])

  if (isUserLoading || !user || activeProfile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Carregando perfis...</p>
      </div>
    )
  }

  const handleProfileSelect = (profile: Profile) => {
    setSelectedProfile(profile)
    setPin("")
  }

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfile) return

    setIsAuthenticating(true)

    // Simulate network delay for UX
    setTimeout(() => {
      const success = loginProfile(selectedProfile.id, pin)
      
      if (success) {
        toast({
          title: `Bem-vindo, ${selectedProfile.nome}`,
          description: `Acesso nível: ${selectedProfile.role.toUpperCase()}`,
        })
        router.push("/dashboard")
      } else {
        toast({
          variant: "destructive",
          title: "Senha incorreta",
          description: "A senha digitada para este perfil está incorreta.",
        })
      }
      
      setIsAuthenticating(false)
      setPin("")
    }, 600)
  }

  const handleLogoutMaster = async () => {
    await signOut(auth)
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" className="text-muted-foreground" onClick={handleLogoutMaster}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair ({user.email})
        </Button>
      </div>

      {!selectedProfile ? (
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold tracking-tight mb-2">Quem está acessando?</h1>
            <p className="text-lg text-muted-foreground">Selecione o seu perfil para entrar no sistema.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {PREDEFINED_PROFILES.map((profile) => (
              <Card 
                key={profile.id} 
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                onClick={() => handleProfileSelect(profile)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <UserCircle2 className="h-14 w-14" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{profile.nome}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{profile.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="w-full max-w-md shadow-xl border-primary/10">
          <CardHeader className="space-y-1 text-center relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-4 top-4"
              onClick={() => setSelectedProfile(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex justify-center mb-2 mt-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Olá, {selectedProfile.nome}</CardTitle>
            <CardDescription>
              Digite sua senha para continuar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handlePinSubmit}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 text-center">
                <Label htmlFor="pin" className="sr-only">Senha (PIN)</Label>
                <Input 
                  id="pin" 
                  type="password" 
                  placeholder="Senha numérica" 
                  className="text-center text-2xl tracking-widest h-14"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  maxLength={6}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full text-lg h-12" type="submit" disabled={isAuthenticating || pin.length < 4}>
                {isAuthenticating ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 
                ) : null}
                {isAuthenticating ? "Validando..." : "Acessar"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  )
}
