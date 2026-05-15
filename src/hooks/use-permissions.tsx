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
        // 1. Busca o usuário atual no DB para descobrir o grupo
        // Como o Profile mockado não tem o ID real do Firestore para alguns casos, vamos tentar buscar.
        // Se usar o Profile ID como document ID na collection usuarios:
        const userSnap = await getDoc(doc(db, "usuarios", activeProfile.id))
        
        let grupoId = null

        if (userSnap.exists()) {
          grupoId = userSnap.data().grupo_id
        }

        // Hack para ambiente de desenvolvimento: Se o activeProfile for 'felype', consideramos ele ROOT
        if (activeProfile.role === "admin" || activeProfile.id === "felype") {
          setIsAdminRoot(true)
          setIsLoading(false)
          return
        }

        if (!grupoId) {
          setMatriz({})
          setIsLoading(false)
          return
        }

        // 2. Busca o Grupo para ver se é ROOT
        const groupSnap = await getDoc(doc(db, "grupos_usuarios", grupoId))
        if (groupSnap.exists() && groupSnap.data().is_admin) {
          setIsAdminRoot(true)
          setIsLoading(false)
          return
        }

        // 3. Busca a matriz de permissões
        const permSnap = await getDoc(doc(db, "permissoes_grupo", grupoId))
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
    
    // Mapeamento de Rotas para Módulos
    if (pathname.startsWith("/configuracoes")) return hasPermission("Configurações", "acessar")
    if (pathname.startsWith("/financeiro")) return hasPermission("Financeiro", "acessar")
    if (pathname.startsWith("/produtos") || pathname.startsWith("/grupos-produtos")) return hasPermission("Produtos", "acessar")
    if (pathname.startsWith("/clientes") || pathname.startsWith("/fornecedores")) return hasPermission("Cadastros", "acessar")
    if (pathname.startsWith("/pdv")) return hasPermission("Vendas", "acessar") // PDV é Vendas de balcão
    if (pathname.startsWith("/orcamentos")) return hasPermission("Orçamentos", "acessar")
    if (pathname.startsWith("/atendimentos")) return hasPermission("CRM", "acessar")
    if (pathname.startsWith("/relatorios")) return hasPermission("Relatórios", "acessar")

    // Rota raiz (Dashboard) todos acessam, mas o que veem depende dos widgets
    if (pathname === "/") return true

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
