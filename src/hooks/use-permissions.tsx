"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react"
import { useProfile } from "@/lib/contexts/profile-context"

type PermissoesMatriz = Record<string, Record<string, boolean>>

interface PermissionsContextType {
  matriz: PermissoesMatriz
  isAdminRoot: boolean
  isLoading: boolean
  hasPermission: (modulo: string, acao: string) => boolean
  canAccessRoute: (pathname: string) => boolean
  hasRole: (role: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  matriz: {},
  isAdminRoot: false,
  isLoading: true,
  hasPermission: () => false,
  canAccessRoute: () => false,
  hasRole: () => false,
})

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { activeProfile, isLoadingProfile } = useProfile()
  
  const [matriz, setMatriz] = useState<PermissoesMatriz>({})
  const [isAdminRoot, setIsAdminRoot] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isLoadingProfile) return

    if (!activeProfile) {
      setMatriz({})
      setIsAdminRoot(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    
    // Define se é Admin Root com base no banco de dados (Prisma)
    const isAdmin = !!activeProfile.isAdmin
    setIsAdminRoot(isAdmin)

    // Reconstrói a matriz Record<Modulo, Record<Acao, Boolean>> a partir do dicionário de permissões
    const newMatriz: PermissoesMatriz = {}
    if (activeProfile && activeProfile.permissions) {
      const perms = activeProfile.permissions as Record<string, boolean>
      Object.keys(perms).forEach((key) => {
        const [module, action] = key.split(':')
        if (module && action) {
          if (!newMatriz[module]) {
            newMatriz[module] = {}
          }
          newMatriz[module][action] = !!perms[key]
        }
      })
    }



    setMatriz(newMatriz)
    setIsLoading(false)
  }, [activeProfile, isLoadingProfile])

  const hasPermission = useCallback((modulo: string, acao: string) => {
    if (isAdminRoot) return true
    if (!matriz[modulo]) return false
    return !!matriz[modulo][acao]
  }, [isAdminRoot, matriz])

  const canAccessRoute = useCallback((pathname: string) => {
    if (isAdminRoot) return true
    
    // Mapeamento de Rotas Livres
    if (pathname === "/" || pathname.startsWith("/dashboard")) return true
    if (pathname.startsWith("/inbox") || pathname.startsWith("/agenda")) return true
    if (pathname.startsWith("/selecionar-perfil")) return true

    // Mapeamento de Rotas para Módulos Oficiais
    if (pathname.startsWith("/configuracoes/usuarios")) return hasPermission("Usuários", "visualizar")
    if (pathname.startsWith("/configuracoes/grupos-usuarios")) return hasPermission("Grupos usuários", "visualizar")
    if (pathname.startsWith("/configuracoes/permissoes")) return hasPermission("Permissões", "visualizar")
    if (pathname.startsWith("/configuracoes/gerais")) return hasPermission("Configurações gerais", "visualizar")
    if (pathname.startsWith("/configuracoes/pdv")) return hasPermission("Configurações PDV", "visualizar")
    if (pathname.startsWith("/configuracoes/logs")) return hasPermission("Logs", "visualizar")
    
    // Rota Base Configurações (Fallback)
    if (pathname.startsWith("/configuracoes")) return hasPermission("Configurações gerais", "visualizar") || hasPermission("Sistema", "visualizar")
    
    if (pathname.startsWith("/contas-a-pagar")) return hasPermission("Contas a pagar", "visualizar")
    if (pathname.startsWith("/contas-a-receber")) return hasPermission("Contas a receber", "visualizar")
    if (pathname.startsWith("/financeiro")) return hasPermission("Financeiro", "acessar")
    
    if (pathname.startsWith("/categorias")) return hasPermission("Categorias", "visualizar")
    if (pathname.startsWith("/marcas")) return hasPermission("Marcas", "visualizar")
    if (pathname.startsWith("/produtos")) return hasPermission("Produtos", "visualizar")
    if (pathname.startsWith("/estoque")) return hasPermission("Estoque", "visualizar")
    if (pathname.startsWith("/compras")) return hasPermission("Compras", "visualizar")
    
    if (pathname.startsWith("/fornecedores")) return hasPermission("Fornecedores", "visualizar")
    if (pathname.startsWith("/clientes")) return hasPermission("Clientes", "visualizar")
    if (pathname.startsWith("/filhos")) return hasPermission("Filhos", "visualizar") || hasPermission("Clientes", "visualizar")
    
    if (pathname.startsWith("/pdv")) return hasPermission("PDV", "visualizar")
    if (pathname.startsWith("/caixa")) return hasPermission("Caixa", "visualizar")
    if (pathname.startsWith("/vendas")) return hasPermission("Vendas", "visualizar")
    if (pathname.startsWith("/orcamentos")) return hasPermission("Orçamentos", "visualizar")
    if (pathname.startsWith("/trocas")) return hasPermission("Trocas", "visualizar")
    if (pathname.startsWith("/devolucoes")) return hasPermission("Devoluções", "visualizar")
    
    if (pathname.startsWith("/relatorios")) return hasPermission("Relatórios", "visualizar")
    if (pathname.startsWith("/crm")) return hasPermission("CRM", "visualizar")

    // Por segurança, se não caiu em nada e não é livre, oculta
    return false
  }, [isAdminRoot, hasPermission])

  const hasRole = useCallback((role: string) => {
    if (isAdminRoot) return role === "admin";
    return false; // Roles are managed by isAdmin flag and permissions
  }, [isAdminRoot])

  const contextValue = useMemo(() => ({
    matriz, isAdminRoot, isLoading, hasPermission, canAccessRoute, hasRole
  }), [matriz, isAdminRoot, isLoading, hasPermission, canAccessRoute, hasRole])

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
