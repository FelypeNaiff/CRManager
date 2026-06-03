'use client';

import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionModule, PermissionAction } from '@/lib/auth/permission-catalog';

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
