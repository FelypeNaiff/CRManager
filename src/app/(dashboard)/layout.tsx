"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Bell, Search, User, Loader2, LogOut, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser, useAuth } from "@/firebase"
import { useProfile } from "@/lib/contexts/profile-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "firebase/auth"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const { activeProfile, isLoadingProfile, logoutProfile } = useProfile()
  const auth = useAuth()
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

  const handleLogoutProfile = () => {
    logoutProfile()
    router.push("/selecionar-perfil")
  }

  const handleLogoutMaster = async () => {
    logoutProfile()
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
                        {activeProfile.nome}
                      </span>
                      <span className="text-xs text-white/70 capitalize mt-1">
                        {activeProfile.role}
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
