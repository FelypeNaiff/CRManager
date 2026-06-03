'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useProfile } from '@/lib/contexts/profile-context';
import { PermissionModule, PermissionAction } from '@/lib/auth/permission-catalog';
import { usePathname } from 'next/navigation';

interface PermissionsContextType {
  isAdmin: () => boolean;
  isLoading: boolean;
  can: (module: PermissionModule, action: PermissionAction) => boolean;
  canAccessRoute: (pathname: string) => boolean;
  canPerformAction: (permissionKey: string) => boolean;
  hasAnyPermission: (permissions: { module: PermissionModule; action: PermissionAction }[]) => boolean;
  hasAllPermissions: (permissions: { module: PermissionModule; action: PermissionAction }[]) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  isAdmin: () => false,
  isLoading: true,
  can: () => false,
  canAccessRoute: () => false,
  canPerformAction: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { activeProfile, isLoadingProfile } = useProfile();
  
  const [permissionsMap, setPermissionsMap] = useState<Record<string, boolean>>({});
  const [isAdminRoot, setIsAdminRoot] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isLoadingProfile) return;

    if (!activeProfile) {
      setPermissionsMap({});
      setIsAdminRoot(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Define se é Admin Root
    const admin = !!activeProfile.isAdmin || !!activeProfile.isOwner;
    setIsAdminRoot(admin);

    if (activeProfile && activeProfile.permissions) {
      setPermissionsMap(activeProfile.permissions as Record<string, boolean>);
    } else {
      setPermissionsMap({});
    }

    setIsLoading(false);
  }, [activeProfile, isLoadingProfile]);

  const can = useCallback((module: PermissionModule, action: PermissionAction) => {
    if (isAdminRoot) return true;
    const key = `${module}:${action}`;
    return !!permissionsMap[key];
  }, [isAdminRoot, permissionsMap]);

  const canPerformAction = useCallback((permissionKey: string) => {
    if (isAdminRoot) return true;
    return !!permissionsMap[permissionKey];
  }, [isAdminRoot, permissionsMap]);

  const canAccessRoute = useCallback((routePathname: string) => {
    if (isAdminRoot) return true;
    
    const PUBLIC_PATHS = ['/login', '/selecionar-perfil', '/setup'];
    const FREE_AUTH_PATHS = ['/dashboard', '/inbox', '/agenda'];
    if (routePathname === '/') return true;
    if (PUBLIC_PATHS.some(p => routePathname.startsWith(p))) return true;
    if (FREE_AUTH_PATHS.some(p => routePathname.startsWith(p))) return true;

    // Based on the middleware mapping:
    if (routePathname.startsWith('/configuracoes/usuarios')) return can('USUARIOS', 'VIEW');
    if (routePathname.startsWith('/configuracoes/grupos-usuarios')) return can('GRUPOS_USUARIOS', 'VIEW');
    if (routePathname.startsWith('/configuracoes/permissoes')) return can('PERMISSOES', 'VIEW');
    if (routePathname.startsWith('/configuracoes/empresa') || routePathname.startsWith('/configuracoes/dados-empresa') || routePathname.startsWith('/configuracoes/minha-empresa')) return can('CONFIGURACOES_EMPRESA', 'VIEW');
    if (routePathname.startsWith('/configuracoes/configuracoes-operacionais')) return can('CONFIGURACOES_OPERACIONAIS', 'VIEW');
    if (routePathname.startsWith('/configuracoes/logs')) return can('LOGS', 'VIEW');
    if (routePathname.startsWith('/configuracoes')) return can('CONFIGURACOES', 'VIEW');

    if (routePathname.startsWith('/financeiro') || routePathname.startsWith('/carteira-saldos') || routePathname.startsWith('/contas-a-pagar') || routePathname.startsWith('/contas-a-receber')) return can('FINANCEIRO', 'VIEW');
    if (routePathname.startsWith('/produtos')) return can('PRODUTOS', 'VIEW');
    if (routePathname.startsWith('/estoque') || routePathname.startsWith('/movimentacoes')) return can('ESTOQUE', 'VIEW');

    if (routePathname.startsWith('/clientes') || routePathname.startsWith('/aniversariantes') || routePathname.startsWith('/clientes-com-saldo')) return can('CLIENTES', 'VIEW');
    if (routePathname.startsWith('/filhos')) return can('FILHOS', 'VIEW');
    if (routePathname.startsWith('/crm/carteira') || routePathname.startsWith('/wallet')) return can('CARTEIRA', 'VIEW');
    if (routePathname.startsWith('/crm')) return can('CRM', 'VIEW');

    if (routePathname.startsWith('/pdv')) return can('PDV', 'VIEW');
    if (routePathname.startsWith('/caixa') || routePathname.startsWith('/financeiro/caixas')) return can('CAIXA', 'VIEW');
    if (routePathname.startsWith('/vendas') || routePathname.startsWith('/comercial/vendas') || routePathname.startsWith('/comercial')) return can('VENDAS', 'VIEW');

    if (routePathname.startsWith('/trocas') || routePathname.startsWith('/comercial/trocas')) return can('TROCAS', 'VIEW');
    if (routePathname.startsWith('/devolucoes') || routePathname.startsWith('/returns') || routePathname.startsWith('/vendas/devolucoes')) return can('DEVOLUCOES', 'VIEW');

    if (routePathname.startsWith('/relatorios') || routePathname.startsWith('/comercial/relatorios')) return can('RELATORIOS', 'VIEW');

    return false;
  }, [isAdminRoot, can]);

  const hasAnyPermission = useCallback((permissions: { module: PermissionModule; action: PermissionAction }[]) => {
    if (isAdminRoot) return true;
    return permissions.some(p => can(p.module, p.action));
  }, [isAdminRoot, can]);

  const hasAllPermissions = useCallback((permissions: { module: PermissionModule; action: PermissionAction }[]) => {
    if (isAdminRoot) return true;
    return permissions.every(p => can(p.module, p.action));
  }, [isAdminRoot, can]);

  const isAdmin = useCallback(() => {
    return isAdminRoot;
  }, [isAdminRoot]);

  const contextValue = useMemo(() => ({
    isAdmin, isLoading, can, canAccessRoute, canPerformAction, hasAnyPermission, hasAllPermissions
  }), [isAdmin, isLoading, can, canAccessRoute, canPerformAction, hasAnyPermission, hasAllPermissions]);

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
