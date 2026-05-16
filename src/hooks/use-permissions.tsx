"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useRouter, usePathname } from "next/navigation"

type PermissoesMatriz = Record<string, Record<string, boolean>>

interface PermissionsContextType {
  matriz: PermissoesMatriz
  isAdminRoot: boolean
  isLoading: boolean
  hasPermission: (modulo: string, acao: string) => boolean
  canAccessRoute: (pathname: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  matriz: {},
  isAdminRoot: false,
  isLoading: true,
  hasPermission: () => false,
  canAccessRoute: () => false,
})

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfile()
  const db = useFirestore()
  
  const [matriz, setMatriz] = useState<PermissoesMatriz>({})
  const [isAdminRoot, setIsAdminRoot] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPermissions() {
      if (!db || !activeProfile?.id) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        
        // Bypass de segurança: Felype e Milena sempre têm acesso total (ROOT)
        const nomeUpper = activeProfile.nome?.toUpperCase() || ""
        const emailLower = activeProfile.email?.toLowerCase() || ""
        
        if (nomeUpper.includes("FELYPE") || nomeUpper.includes("MILENA") || emailLower === "felypenaiff01@gmail.com") {
          setIsAdminRoot(true)
          setIsLoading(false)
          return
        }
        
        // 1. Busca o grupo do usuário para validar se é Root Admin (is_admin)
        if (activeProfile.grupo_id && activeProfile.grupo_id !== "none") {
          const groupSnap = await getDoc(doc(db, "grupos_usuarios", activeProfile.grupo_id))
          if (groupSnap.exists() && groupSnap.data().is_admin) {
            setIsAdminRoot(true)
            setIsLoading(false)
            return
          }
        }

        setIsAdminRoot(false)

        // 2. Se não tem grupo ou não for root, carrega a matriz de permissões
        if (!activeProfile.grupo_id || activeProfile.grupo_id === "none") {
          setMatriz({})
          setIsLoading(false)
          return
        }

        const permSnap = await getDoc(doc(db, "permissoes_grupo", activeProfile.grupo_id))
        if (permSnap.exists() && permSnap.data().matriz) {
          setMatriz(permSnap.data().matriz)
        } else {
          setMatriz({})
        }

      } catch (e) {
        console.error("Erro ao carregar permissões", e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPermissions()
  }, [db, activeProfile])

  const hasPermission = (modulo: string, acao: string) => {
    if (isAdminRoot) return true
    if (!matriz[modulo]) return false
    return !!matriz[modulo][acao]
  }

  const canAccessRoute = (pathname: string) => {
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
    if (pathname.startsWith("/filhos")) return hasPermission("Filhos", "visualizar")
    
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
  }

  return (
    <PermissionsContext.Provider value={{ matriz, isAdminRoot, isLoading, hasPermission, canAccessRoute }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
