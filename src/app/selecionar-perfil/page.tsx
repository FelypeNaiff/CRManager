"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser, useFirestore } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, UserCircle2, ShieldCheck, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase"
import { useProfile } from "@/lib/contexts/profile-context"
import { toast } from "@/hooks/use-toast"

const AVAILABLE_PROFILES = [
  { id: "milena", nome: "MILENA", role: "ADMINISTRADOR", description: "Acesso administrativo total" },
  { id: "thais", nome: "THAIS", role: "ADMINISTRADOR", description: "Acesso administrativo total" },
  { id: "vendedor", nome: "VENDEDOR", role: "ACESSO LIMITADO", description: "Rotinas comerciais e vendas" },
  { id: "caixa", nome: "CAIXA", role: "ACESSO LIMITADO", description: "PDV e recebimentos" },
]

export default function SelecionarPerfilPage() {
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { loginProfile } = useProfile()
  const [isSelecting, setIsSelecting] = useState<string | null>(null)

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push("/login")
      }
    }
  }, [user, isUserLoading, router])

  const handleSelectProfile = async (profileDef: typeof AVAILABLE_PROFILES[0]) => {
    if (!user || !db) return
    setIsSelecting(profileDef.id)

    try {
      // Registra a sessão no Firestore
      const sessionRef = await addDoc(collection(db, "login_sessions"), {
        google_email: user.email,
        google_name: user.displayName,
        selected_profile: profileDef.nome,
        profile_role: profileDef.role,
        login_at: serverTimestamp(),
        logout_at: null,
        // Informações adicionais podem ser capturadas aqui (ex: user agent)
        device_info: navigator.userAgent
      })

      // Cria o perfil local para o sistema (compatível com os tipos existentes)
      const activeProfileData = {
        id: profileDef.id,
        nome: profileDef.nome,
        email: user.email || "",
        empresaId: "trupe-kids", // Empresa padrão do sistema
        role: profileDef.role === "ADMINISTRADOR" ? "admin" : "operador",
        status: "ATIVO" as "ATIVO",
        permitir_acesso: true,
        pin_acesso: "",
        grupo_id: profileDef.role,
        sessionId: sessionRef.id // Guardamos a ID da sessão para o logout
      }

      loginProfile(activeProfileData)
      router.push("/dashboard")
    } catch (error) {
      console.error("Erro ao iniciar sessão:", error)
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível iniciar a sessão." })
      setIsSelecting(null)
    }
  }

  const handleCancel = async () => {
    await signOut(auth)
    router.push("/login")
  }

  if (isUserLoading || !user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Validando credenciais...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Selecione o Perfil de Acesso</h1>
          <p className="text-slate-500">Logado como <strong className="text-slate-700">{user.email}</strong></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_PROFILES.map((profile) => (
            <Card 
              key={profile.id} 
              className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${isSelecting === profile.id ? 'border-primary ring-2 ring-primary/20' : ''}`}
              onClick={() => !isSelecting && handleSelectProfile(profile)}
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${profile.role === 'ADMINISTRADOR' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                    {profile.role === 'ADMINISTRADOR' ? <ShieldCheck className="h-6 w-6" /> : <UserCircle2 className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{profile.nome}</h3>
                    <p className="text-sm font-medium text-slate-500">{profile.role}</p>
                    <p className="text-xs text-slate-400 mt-1">{profile.description}</p>
                  </div>
                </div>
                {isSelecting === profile.id && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <Button variant="ghost" className="text-slate-500 hover:text-slate-700 gap-2" onClick={handleCancel}>
            <LogOut className="h-4 w-4" />
            Sair e usar outra conta
          </Button>
        </div>
      </div>
    </div>
  )
}
