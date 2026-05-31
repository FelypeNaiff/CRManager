"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Bell, User, LogOut, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface SessionData {
  userId: string
  name: string
  email: string
  role: string
  isAdmin: boolean
  companyId?: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { activeProfile, isLoadingProfile, loginProfile, logoutProfile } = useProfile()
  const router = useRouter()

  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)

  // On mount: fetch real session from the HTTP-only cookie via API
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (res.ok) {
          const body = await res.json()
          if (body.authenticated && body.session) {
            const sess: SessionData = body.session
            setSessionData(sess)

            // Sync profile context from real session
            loginProfile({
              id: sess.userId,
              nome: sess.name,
              email: sess.email,
              role: sess.role,
              isAdmin: sess.isAdmin,
              empresaId: sess.companyId,
              permissions: (sess as any).permissions,
            })
          } else {
            // No valid session — redirect to login
            window.location.replace('/login')
          }
        } else {
          window.location.replace('/login')
        }
      } catch (err) {
        console.error('[DashboardLayout] Session fetch failed:', err)
        window.location.replace('/login')
      } finally {
        setIsSessionLoading(false)
      }
    }

    loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogoutMaster = async () => {
    logoutProfile()
    await logoutProfileSession()
    window.location.replace('/login')
  }

  // Loading skeleton
  if (isSessionLoading) {
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

  // Session confirmed — use sessionData as the source of truth for display
  const displayName = sessionData?.name || activeProfile?.nome || 'Usuário'
  const displayEmail = sessionData?.email || ''
  const displayRole = sessionData?.role || activeProfile?.role || ''

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between bg-[#1e2229] text-white px-4 transition-[width,height] ease-linear shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 font-headline font-bold text-lg mr-6">
                <Store className="h-5 w-5 text-primary" />
                <span className="tracking-tight uppercase">NEEX <span className="text-primary font-normal text-sm">SISTEMA DE GESTÃO DE VENDAS</span></span>
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
                        {displayName} {displayEmail ? `(${displayEmail})` : ''}
                      </span>
                      <span className="text-xs text-white/70 capitalize mt-1">
                        {displayRole}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
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
