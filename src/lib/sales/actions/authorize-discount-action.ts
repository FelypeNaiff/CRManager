'use server';

import { getActiveProfileSession } from "@/lib/auth/actions";
import { verifyPin } from "@/lib/auth/pin";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const authorizeDiscountSchema = z.object({
  authorizationId: z.string().uuid(),
  pin: z.string().min(4)
});

export async function authorizeDiscountAction(data: { authorizationId: string, pin: string }) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    action: "AUTHORIZE_DISCOUNT_REQUEST",
    authorizationId: data.authorizationId
  }));

  try {
    const session = await getActiveProfileSession();
    if (!session?.companyId) throw new Error("Não autenticado");

    const { authorizationId, pin } = authorizeDiscountSchema.parse(data);

    // 1. Fetch authorization request
    const authReq = await prisma.actionAuthorization.findUnique({
      where: { id: authorizationId }
    });

    if (!authReq || authReq.companyId !== session.companyId) {
      throw new Error("Autorização não encontrada.");
    }
    
    if (authReq.status === 'APPROVED') {
      return { success: true, authorizationId: authReq.id };
    }

    // 2. Find user with the PIN
    // A user with this PIN must have sales.discount.authorize or pdv.discount.authorize
    const usersWithPin = await prisma.user.findMany({
      where: {
        companyId: session.companyId,
        status: "ACTIVE",
        authorizationPinHash: { not: null }
      },
      include: {
        role: {
          include: { permissions: true }
        }
      }
    });

    let authorizedUser = null;
    for (const user of usersWithPin) {
      if (user.authorizationPinHash && await verifyPin(pin, user.authorizationPinHash)) {
        // Check permission
        const hasPermission = user.role.permissions.some(p => 
          p.name === 'sales.discount.authorize' || p.name === 'pdv.discount.authorize'
        );
        if (hasPermission) {
          authorizedUser = user;
          break;
        } else {
          throw new Error("O usuário deste PIN não possui permissão para autorizar descontos.");
        }
      }
    }

    if (!authorizedUser) {
      throw new Error("PIN inválido ou incorreto.");
    }

    // 3. Approve authorization
    await prisma.actionAuthorization.update({
      where: { id: authorizationId },
      data: {
        status: 'APPROVED',
        authorizedByUserId: authorizedUser.id,
        resolvedAt: new Date(),
        reason: authReq.reason || 'Desconto autorizado via PIN'
      }
    });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      action: "AUTHORIZE_DISCOUNT_SUCCESS",
      authorizationId,
      authorizedByUserId: authorizedUser.id
    }));

    return { success: true, authorizationId: authReq.id };
  } catch (error: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      action: "AUTHORIZE_DISCOUNT_FAILURE",
      authorizationId: data.authorizationId,
      error: error.message
    }));
    return { success: false, error: error.message };
  }
}
