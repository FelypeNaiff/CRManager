'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ServerAuthContext } from './server-auth-context';
import { resolveAuditActor } from './audit-actor';
import {
  sanitizeAuditDetails,
  sanitizeAuditMetadata,
  type AuditMetadata,
} from './audit-sanitization';

export interface ActivityLogInput {
  context: ServerAuthContext;
  action: string;
  module: string;
  recordId?: string;
  details?: string;
  metadata?: AuditMetadata;
}

export type ActivityLogOptions =
  | { policy: 'CRITICAL'; tx: Prisma.TransactionClient }
  | { policy: 'BEST_EFFORT'; tx?: Prisma.TransactionClient };

export async function writeActivityLog(
  input: ActivityLogInput,
  options: ActivityLogOptions,
): Promise<boolean> {
  const actor = resolveAuditActor(input.context);
  const db = options.tx ?? prisma;
  try {
    await db.activityLog.create({
      data: {
        companyId: actor.companyId,
        actorUserId: actor.actorUserId,
        authenticatedUserId: actor.authenticatedUserId,
        action: input.action,
        module: input.module,
        recordId: input.recordId ?? null,
        details: sanitizeAuditDetails(input.details) ?? null,
        metadata: sanitizeAuditMetadata(input.metadata) ?? Prisma.JsonNull,
      },
    });
    return true;
  } catch (error) {
    if (options.policy === 'CRITICAL') throw error;
    console.error('[ActivityLog] BEST_EFFORT write failed:', error);
    return false;
  }
}

/**
 * Transitional compatibility for modules instrumented before effective-actor
 * context existed. It deliberately records the same User as base and actor.
 * New instrumentation must use writeActivityLog with a ServerAuthContext.
 */
export async function writeLegacyActivityLog(payload: {
  companyId: string;
  userId: string;
  action: string;
  module: string;
  recordId?: string;
  details?: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        companyId: payload.companyId,
        actorUserId: payload.userId,
        authenticatedUserId: payload.userId,
        action: payload.action,
        module: payload.module,
        recordId: payload.recordId ?? null,
        details: sanitizeAuditDetails(payload.details) ?? null,
      },
    });
  } catch (error) {
    console.error('[ActivityLog] Legacy BEST_EFFORT write failed:', error);
  }
}
