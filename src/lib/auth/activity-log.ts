'use server';

import { prisma } from '@/lib/prisma';

interface ActivityLogPayload {
  companyId: string;
  userId: string;
  action: string;   // LOGIN | LOGOUT | PIN_FALHOU | ACESSO_NEGADO | TROCA_PERFIL | CREATE | UPDATE | DELETE
  module: string;   // Auth | Vendas | Clientes | Estoque | etc.
  recordId?: string;
  details?: string;
}

/**
 * Writes a security/audit event to the activity_logs table.
 * Fails silently so it never breaks the main flow.
 */
export async function writeActivityLog(payload: ActivityLogPayload): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        action: payload.action,
        module: payload.module,
        recordId: payload.recordId ?? null,
        details: payload.details ?? null,
      },
    });
  } catch (error) {
    // Silent — logging must never crash the application
    console.error('[ActivityLog] Failed to write log entry:', error);
  }
}
