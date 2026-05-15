"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Building2, 
  Users, 
  UsersRound, 
  ShieldCheck, 
  Settings, 
  Store, 
  Receipt, 
  FileBadge, 
  ScrollText 
} from "lucide-react"

const configRoutes = [
  {
    title: "Minha Empresa",
    href: "/configuracoes/minha-empresa",
    icon: Building2,
  },
  {
    title: "Usuários",
    href: "/configuracoes/usuarios",
    icon: Users,
  },
  {
    title: "Grupos de Usuários",
    href: "/configuracoes/grupos-usuarios",
    icon: UsersRound,
  },
  {
    title: "Permissões",
    href: "/configuracoes/permissoes",
    icon: ShieldCheck,
  },
  {
    title: "Configurações Gerais",
    href: "/configuracoes/gerais",
    icon: Settings,
  },
  {
    title: "PDV / Vendas de Balcão",
    href: "/configuracoes/pdv",
    icon: Store,
  },
  {
    title: "Fiscal",
    href: "/configuracoes/fiscal",
    icon: Receipt,
  },
  {
    title: "Certificado Digital",
    href: "/configuracoes/certificado-digital",
    icon: FileBadge,
  },
  {
    title: "Logs de Atividades",
    href: "/configuracoes/logs",
    icon: ScrollText,
  },
]

export function ConfigSidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 border-r bg-muted/10 h-full flex flex-col">
      <div className="p-6 pb-4">
        <h2 className="text-lg font-bold tracking-tight">Configurações</h2>
        <p className="text-xs text-muted-foreground mt-1">Gerencie os parâmetros do seu sistema</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {configRoutes.map((route) => {
          const isActive = pathname === route.href || pathname.startsWith(`${route.href}/`)
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <route.icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              {route.title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
