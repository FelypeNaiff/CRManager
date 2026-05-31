"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/firebase"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, UserCircle2, LogOut, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase"
import { useProfile } from "@/lib/contexts/profile-context"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getAvailableProfiles, validateProfilePin } from "@/lib/auth/actions"

export default function SelecionarPerfilPage() {
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const auth = useAuth()
  const { loginProfile } = useProfile()
  const [isSelecting, setIsSelecting] = useState<string | null>(null)
  const [selectedUserForPin, setSelectedUserForPin] = useState<any>(null)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState("")
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)

  // Busca de usuários dinamicamente do banco relacional PostgreSQL via Prisma
  useEffect(() => {
    async function loadProfiles() {
      try {
        setIsLoadingUsers(true)
        const res = await getAvailableProfiles()
        if (res.success && res.profiles) {
          setAvailableProfiles(res.profiles)
        } else {
          toast({ variant: "destructive", title: "Erro", description: res.error || "Não foi possível carregar os perfis." })
        }
      } catch (error) {
        console.error("Erro ao carregar perfis do Prisma:", error)
        toast({ variant: "destructive", title: "Erro", description: "Falha de conexão com o banco de dados." })
      } finally {
        setIsLoadingUsers(false)
      }
    }
    if (user) {
      loadProfiles()
    }
  }, [user])

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push("/login")
      }
    }
  }, [user, isUserLoading, router])

  const handleProfileClick = (profileDef: any) => {
    setSelectedUserForPin(profileDef)
    setPin("")
    setPinError("")
  }

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user) return
    if (!selectedUserForPin) return

    setPinError("")
    setIsSelecting(selectedUserForPin.id)

    try {
      // Valida o PIN de forma segura exclusivamente no servidor (bcrypt)
      const res = await validateProfilePin(selectedUserForPin.id, pin)

      if (!res.success || !res.profile) {
        setPinError(res.error || "Senha incorreta.")
        setIsSelecting(null)
        return
      }

      setSelectedUserForPin(null) // Fecha o modal
      
      // Salva o perfil com as permissões no contexto local (localStorage)
      loginProfile(res.profile)
      
      toast({
        title: "Acesso autorizado!",
        description: `Operador ${res.profile.nome} conectado com sucesso.`,
      })
      
      router.push("/dashboard")
    } catch (error) {
      console.error("Erro ao validar PIN no servidor:", error)
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível autenticar o perfil no servidor." })
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

        {isLoadingUsers ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : availableProfiles.length === 0 ? (
          <div className="text-center p-8 bg-white/50 backdrop-blur-sm rounded-lg border border-slate-200 text-slate-500 shadow-sm">
            Nenhum perfil ativo com acesso ao sistema foi encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableProfiles.map((profile: any) => (
              <Card 
                key={profile.id} 
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${isSelecting === profile.id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-white/80 backdrop-blur-sm'}`}
                onClick={() => !isSelecting && handleProfileClick(profile)}
              >
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
                      <UserCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{profile.nome}</h3>
                      <p className="text-sm font-medium text-slate-500">{profile.cargo || "Sem cargo definido"}</p>
                    </div>
                  </div>
                  {isSelecting === profile.id ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LockKeyhole className="h-4 w-4 text-slate-300" />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-8">
          <Button variant="ghost" className="text-slate-500 hover:text-slate-700 gap-2" onClick={handleCancel}>
            <LogOut className="h-4 w-4" />
            Sair e usar outra conta
          </Button>
        </div>
      </div>

      {/* MODAL DE VALIDAÇÃO DE PIN */}
      <Dialog open={!!selectedUserForPin} onOpenChange={(open) => !open && handleProfileClick(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Acesso Restrito</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-6">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2">
              <UserCircle2 className="h-8 w-8" />
            </div>
            <p className="text-center text-slate-600 font-medium">
              Digite o PIN de acesso para <br/>
              <strong className="text-slate-900 text-lg uppercase">{selectedUserForPin?.nome}</strong>
            </p>
            <form onSubmit={handlePinSubmit} className="w-full flex flex-col items-center gap-4">
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="text-center text-3xl tracking-[0.5em] w-40 h-14"
                autoFocus
              />
              {pinError && <p className="text-rose-500 text-sm font-medium">{pinError}</p>}
              <Button type="submit" className="w-full mt-2" disabled={pin.length < 4}>
                Confirmar Acesso
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
