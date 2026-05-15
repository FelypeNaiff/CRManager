"use client"

import { ReactNode } from "react"
import { usePermissions } from "@/hooks/use-permissions"

interface PermissionGateProps {
  modulo: string
  acao: string
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Envolve botões ou partes da tela que exigem permissão.
 * Se o usuário não tiver a permissão (ou não for admin root), renderiza nulo (ou fallback).
 */
export function PermissionGate({ modulo, acao, children, fallback = null }: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions()

  if (isLoading) return null // Evita piscar a UI enquanto checa

  if (hasPermission(modulo, acao)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
