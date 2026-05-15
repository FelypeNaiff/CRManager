"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { ConfigSidebar } from "@/components/layout/config-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RequirePermission } from "@/components/permissions/require-permission"

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
