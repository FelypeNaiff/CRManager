'use client';

import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionModule, PermissionAction } from '@/lib/auth/permission-catalog';

interface PermissionGateProps {
  module?: PermissionModule;
  action?: PermissionAction;
  permissions?: { module: PermissionModule; action: PermissionAction }[];
  requireAll?: boolean;
  children: React.ReactNãode;
  fallback?: React.ReactNãode;
}

export function PermissionGate({
  module,
  action,
  permissions,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can, hasAnyPermission, hasAllPermissions, isLoading, isAdmin } = usePermissions();

  if (isLoading) {
    // Return empty fallback while loading to avoid layout shifts or exposing protected content
    return fallback;
  }

  if (isAdmin()) {
    return <>{children}</>;
  }

  let hasAccess = false;

  if (module && action) {
    hasAccess = can(module, action);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
