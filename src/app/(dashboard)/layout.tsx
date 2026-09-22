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
import { logoutSession } from "@/lib/auth/actions"
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
        clearTimeout(timeoutId);
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
            // Não valid session — redirect to login
            window.location.replace('/login')
          }
        } else {
          window.location.replace('/login')
        }
      } catch {
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
    await logoutSession()
    window.location.replace('/login')
  }

  // Loading skeleton
  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <div className="w-[var(--sidebar-width,16rem)] border-r bg-sidebar hidden md:flex flex-col shrink-0">
          <div className="h-16 border-b flex items-center px-4 shrink-0">
            <div className="h-7 w-32 bg-slate-100 animate-pulse rounded-lg"></div>
          </div>
          <div className="p-4 space-y-4 flex-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-accent animate-pulse rounded-lg"></div>
                <div className="h-4 w-24 bg-slate-100 animate-pulse rounded"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col h-screen overflow-hidden bg-background">
          <header className="h-16 border-b bg-card flex items-center justify-between px-5 shrink-0">
            <div className="h-6 w-48 bg-slate-100 animate-pulse rounded"></div>
            <div className="h-9 w-9 rounded-full bg-accent animate-pulse"></div>
          </header>
          <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="space-y-6 max-w-7xl w-full">
              <div className="flex flex-col gap-3 mb-8">
                <div className="h-8 w-64 bg-slate-200 animate-pulse rounded"></div>
                <div className="h-4 w-96 bg-slate-200 animate-pulse rounded"></div>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-card border shadow-sm animate-pulse rounded-xl"></div>
                ))}
              </div>
              <div className="h-96 bg-card border shadow-sm animate-pulse rounded-xl mt-6"></div>
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
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/95 px-4 text-foreground shadow-[0_1px_12px_rgba(15,23,42,0.035)] backdrop-blur-md transition-[width,height] ease-linear md:px-6">
            <div className="flex items-center gap-2">
              <div className="mr-5 flex items-center gap-2.5 font-headline font-bold text-base">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
                  <Store className="h-4 w-4" />
                </div>
                <span className="hidden tracking-tight sm:inline">NEEX <span className="font-semibold text-primary">FLOW</span></span>
              </div>
              <SidebarTrigger className="rounded-lg text-muted-foreground hover:bg-accent hover:text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-primary">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full border-2 border-card bg-destructive"></span>
              </Button>
              <div className="mx-1 h-7 w-px bg-border"></div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 gap-2 rounded-xl px-2 text-foreground hover:bg-accent">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent ring-1 ring-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="hidden sm:flex flex-col items-start text-left">
                      <span className="max-w-40 truncate text-sm font-medium leading-none">
                        {displayName} {displayEmail ? `(${displayEmail})` : ''}
                      </span>
                      <span className="mt-1 text-[11px] capitalize text-muted-foreground">
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
          <main className="flex flex-1 flex-col overflow-y-auto bg-background p-4 md:p-6 lg:p-7">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
