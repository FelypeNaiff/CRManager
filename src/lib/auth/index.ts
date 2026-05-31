/**
 * Auth module barrel export.
 * Import from '@/lib/auth' instead of individual files.
 *
 * @example
 * import { requirePermission, can, hasRole, requireAdmin } from '@/lib/auth';
 */

// Server Actions (require 'use server' context)
export {
  validateProfilePin,
  logoutProfileSession,
  getActiveProfileSession,
  getAvailableProfiles,
  checkEmailIsAuthorized,
  type ActiveProfileSession,
} from './actions';

// Permission helpers (Server Components & Server Actions)
export {
  getUserPermissions,
  checkUserPermission,
  canUserAccessRoute,
  can,
  hasRole,
  isAdminSession,
  requirePermission,
  requireAuth,
  requireAdmin,
  type PermissionAction,
  type SystemModule,
} from './permissions';

// PIN utilities
export { hashPin, verifyPin } from './pin';

// Activity log writer
export { writeActivityLog } from './activity-log';
