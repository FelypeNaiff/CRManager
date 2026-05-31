"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Bell, Search, User, LogOut, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser, useAuth, useFirestore } from "@/supabase-mocks"
import { useProfile } from "@/lib/contexts/profile-context"
import { logoutProfileSession } from "@/lib/auth/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/supabase-mocks/auth"
import { doc, updateDoc, serverTimestamp } from "@/supabase-mocks/firestore"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const { activeProfile, isLoadingProfile, logoutProfile, loginProfile } = useProfile()
  const auth = useAuth()
  const router = useRouter()
  const db = useFirestore()

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    } else if (!isUserLoading && user && !isLoadingProfile && !activeProfile && window.location.pathname !== '/selecionar-perfil') {
      // Se tem usuário Google mas não tem perfil logado, força a seleção
      router.push("/selecionar-perfil")
    }
  }, [user, isUserLoading, activeProfile, isLoadingProfile, router])

  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <div className="w-[var(--sidebar-width,16rem)] border-r bg-slate-900 hidden md:flex flex-col shrink-0">
           <div className="h-14 border-b border-slate-800 flex items-center px-4 shrink-0">
             <div className="h-6 w-32 bg-slate-800 animate-pulse rounded"></div>
           </div>
           <div className="p-4 space-y-4 flex-1">
             {Array.from({ length: 8 }).map((_, i) => (
               <div key={i} className="flex items-center gap-3">
                 <div className="h-8 w-8 bg-slate-800 animate-pulse rounded-md"></div>
                 <div className="h-4 w-24 bg-slate-800 animate-pulse rounded"></div>
               </div>
             ))}
           </div>
        </div>
        
        <div className="flex flex-1 flex-col h-screen overflow-hidden bg-background">
          <header className="h-14 border-b bg-[#1e2229] flex items-center justify-between px-4 shrink-0">
             <div className="h-6 w-48 bg-slate-800 animate-pulse rounded"></div>
             <div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse"></div>
          </header>
          
          <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
             <div className="space-y-6 max-w-7xl w-full">
               <div className="flex flex-col gap-3 mb-8">
                 <div className="h-8 w-64 bg-slate-200 animate-pulse rounded"></div>
                 <div className="h-4 w-96 bg-slate-200 animate-pulse rounded"></div>
               </div>
               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                 {Array.from({ length: 4 }).map((_, i) => (
                   <div key={i} className="h-32 bg-white border shadow-sm animate-pulse rounded-xl"></div>
                 ))}
               </div>
               <div className="h-96 bg-white border shadow-sm animate-pulse rounded-xl mt-6"></div>
             </div>
          </main>
        </div>
      </div>
    )
  }

  if (!user || !activeProfile) return null

  const handleLogoutProfile = async () => {
    logoutProfile()
    await logoutProfileSession()
    router.push("/selecionar-perfil")
  }

  const handleLogoutMaster = async () => {
    // Gravar horário de logout na sessão
    if (db && (activeProfile as any)?.sessionId) {
      try {
        await updateDoc(doc(db, "login_sessions", (activeProfile as any).sessionId), {
          logout_at: serverTimestamp()
        })
      } catch (e) {
        console.error("Erro ao registrar logout:", e)
      }
    }

    logoutProfile()
    await logoutProfileSession()
    await signOut(auth)
    router.push("/login")
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between bg-[#1e2229] text-white px-4 transition-[width,height] ease-linear shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 font-headline font-bold text-lg mr-6">
                <Store className="h-5 w-5 text-primary" />
                <span className="tracking-tight uppercase">TRUPE KIDS <span className="text-primary font-normal text-sm">MODA INFANTIL</span></span>
              </div>
              <SidebarTrigger className="text-white hover:bg-white/10" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative hover:bg-white/10 text-white rounded-none h-14 w-12">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive border-2 border-background"></span>
              </Button>
              <div className="h-8 w-px bg-white/10 mx-1"></div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 hover:bg-white/10 text-white">
                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="hidden sm:flex flex-col items-start text-left">
                      <span className="text-sm font-medium leading-none">
                        {activeProfile.nome} ({user.email})
                      </span>
                      <span className="text-xs text-white/70 capitalize mt-1">
                        {activeProfile.grupo_id || activeProfile.role}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogoutProfile} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Trocar de Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogoutMaster} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair do Sistema</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
