"use client"

import { ReactNode, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/use-permissions"
import { ShieldAlert } from "lucide-react"

interface RequirePermissionProps {
  modulo?: string
  acao?: string
  children: ReactNode
}

/**
 * Envolve Páginas Inteiras.
 * Se o usuário não tiver permissão, exibe uma tela de bloqueio e não renderiza os children.
 * Se nenhum módulo for passado, ele valida pela URL atual (canAccessRoute).
 */
export function RequirePermission({ modulo, acao = "acessar", children }: RequirePermissionProps) {
  const { hasPermission, canAccessRoute, isLoading } = usePermissions()
  const pathname = usePathname()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  let authorized = false

  if (modulo) {
    authorized = hasPermission(modulo, acao)
  } else {
    authorized = canAccessRoute(pathname)
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-rose-50 p-6 rounded-full mb-6">
          <ShieldAlert className="h-16 w-16 text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Negado</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Você não possui as permissões necessárias para acessar este módulo. 
          Solicite a liberação ao administrador do sistema.
        </p>
        <button 
          onClick={() => router.push("/")}
          className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  return <>{children}</>
}
