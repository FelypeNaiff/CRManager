'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from './permissions';
import { sanitizeAuditDetails, sanitizeAuditMetadata } from './audit-sanitization';
import { sanitizeAuditForDisplay } from './audit-display';

export interface ActivityLogFilters {
  page?: number; pageSize?: number; startDate?: string; endDate?: string;
  actorUserId?: string; authenticatedUserId?: string; action?: string; module?: string;
  recordId?: string; search?: string; companyId?: string;
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const auth = await requirePermission('LOGS', 'VIEW');
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 25));
  const search = filters.search?.trim().slice(0, 100);
  const where: any = {
    companyId: auth.companyId,
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.authenticatedUserId ? { authenticatedUserId: filters.authenticatedUserId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.recordId ? { recordId: filters.recordId.trim().slice(0, 100) } : {}),
    ...(search ? { details: { contains: search, mode: 'insensitive' } } : {}),
  };
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(`${filters.endDate}T23:59:59.999`);
  }

  const [total, logs, users, facets] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, actorUserId: true, authenticatedUserId: true, action: true, module: true,
        recordId: true, details: true, metadata: true, createdAt: true,
        actorUser: { select: { name: true, role: { select: { name: true } } } },
        authenticatedUser: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { companyId: auth.companyId }, orderBy: { name: 'asc' },
      select: { id: true, name: true, role: { select: { name: true } } },
    }),
    prisma.activityLog.findMany({
      where: { companyId: auth.companyId }, distinct: ['module', 'action'],
      select: { module: true, action: true }, take: 500,
    }),
  ]);

  return {
    logs: logs.map(log => ({
      ...log,
      details: sanitizeAuditDetails(log.details ?? undefined) ?? null,
      metadata: sanitizeAuditForDisplay(sanitizeAuditMetadata(log.metadata as any) ?? null),
    })),
    users,
    modules: [...new Set(facets.map(item => item.module))].sort(),
    actions: [...new Set(facets.map(item => item.action))].sort(),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
