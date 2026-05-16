"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ConfigSidebar } from "@/components/layout/config-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RequirePermission } from "@/components/permissions/require-permission"
import { useUser } from "@/firebase"
import { useProfile } from "@/lib/contexts/profile-context"
import { Loader2 } from "lucide-react"

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const { activeProfile, isLoadingProfile } = useProfile()
  const router = useRouter()

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    } else if (!isUserLoading && user && !isLoadingProfile && !activeProfile) {
      router.push("/selecionar-perfil")
    }
  }, [user, isUserLoading, activeProfile, isLoadingProfile, router])

  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Validando acesso...</p>
      </div>
    )
  }

  if (!user || !activeProfile) return null

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 h-screen overflow-hidden">
            <ConfigSidebar />
            <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8">
              <RequirePermission modulo="Configurações" acao="acessar">
                {children}
              </RequirePermission>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
