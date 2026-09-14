'use client';

import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionModule, PermissionAction } from '@/lib/auth/permission-catalog';
import { usePathname } from 'next/navigation';

export function RequirePermission({
  module,
  action,
  children,
  fallback = null,
}: {
  module: PermissionModule;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, isLoading, isAdmin } = usePermissions();

  if (isLoading) return <>{fallback}</>;

  if (isAdmin()) return <>{children}</>;

  if (can(module, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

export function RequireRoutePermission({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { canAccessRoute, isLoading } = usePermissions();

  if (isLoading) return <>{fallback}</>;
  return canAccessRoute(pathname) ? <>{children}</> : <>{fallback}</>;
}
