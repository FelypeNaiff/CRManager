"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ConfigSidebar } from "@/components/layout/config-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RequirePermission } from "@/components/permissions/require-permission"
import { useProfile } from "@/lib/contexts/profile-context"

interface SessionData {
  userId: string
  name: string
  email: string
  role: string
  isAdmin: boolean
  companyId?: string
  permissions?: Record<string, boolean>
}

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { activeProfile, loginProfile } = useProfile()
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
              permissions: sess.permissions,
            })
          } else {
            window.location.replace('/login')
          }
        } else {
          window.location.replace('/login')
        }
      } catch (err) {
        console.error('[ConfiguracoesLayout] Session fetch failed:', err)
        window.location.replace('/login')
      } finally {
        setIsSessionLoading(false)
      }
    }

    loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        {/* Skeleton Sidebar Principal */}
        <div className="w-[var(--sidebar-width,16rem)] border-r bg-slate-900 hidden md:flex flex-col shrink-0">
           <div className="h-14 border-b border-slate-800 flex items-center px-4 shrink-0">
             <div className="h-6 w-32 bg-slate-800 animate-pulse rounded"></div>
           </div>
           <div className="p-4 space-y-4 flex-1">
             {Array.from({ length: 6 }).map((_, i) => (
               <div key={i} className="flex items-center gap-3">
                 <div className="h-8 w-8 bg-slate-800 animate-pulse rounded-md"></div>
                 <div className="h-4 w-24 bg-slate-800 animate-pulse rounded"></div>
               </div>
             ))}
           </div>
        </div>
        
        {/* Esqueleto da área de conteúdo */}
        <div className="flex flex-1 flex-col h-screen overflow-hidden bg-background">
          <header className="h-14 border-b bg-[#1e2229] flex items-center px-4 shrink-0">
             <div className="h-6 w-48 bg-slate-800 animate-pulse rounded"></div>
          </header>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Skeleton Sidebar de Configurações */}
            <div className="w-[15rem] border-r bg-slate-50 hidden lg:block p-4 space-y-6 shrink-0">
               <div className="h-5 w-32 bg-slate-200 animate-pulse rounded mb-4"></div>
               {Array.from({ length: 4 }).map((_, i) => (
                 <div key={i} className="h-8 w-full bg-slate-200 animate-pulse rounded-md"></div>
               ))}
               <div className="h-5 w-32 bg-slate-200 animate-pulse rounded mt-8 mb-4"></div>
               {Array.from({ length: 3 }).map((_, i) => (
                 <div key={i} className="h-8 w-full bg-slate-200 animate-pulse rounded-md"></div>
               ))}
            </div>

            <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8">
               <div className="space-y-6 max-w-5xl w-full pt-4">
                 <div className="flex flex-col gap-3 mb-8">
                   <div className="h-4 w-32 bg-slate-200 animate-pulse rounded"></div>
                   <div className="h-8 w-64 bg-slate-200 animate-pulse rounded"></div>
                   <div className="h-4 w-96 bg-slate-200 animate-pulse rounded"></div>
                 </div>
                 <div className="grid gap-6 md:grid-cols-2">
                   <div className="h-64 bg-white border shadow-sm animate-pulse rounded-xl"></div>
                   <div className="h-64 bg-white border shadow-sm animate-pulse rounded-xl"></div>
                 </div>
               </div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionData || !activeProfile) return null

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 h-screen overflow-hidden">
            <ConfigSidebar />
            <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8">
              <RequirePermission module="CONFIGURACOES" action="VIEW">
                {children}
              </RequirePermission>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
