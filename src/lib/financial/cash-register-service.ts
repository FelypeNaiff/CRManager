'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { Prisma } from '@prisma/client';
import { CashRegisterOpenSchema, CashRegisterCloseSchema, CashMovementSchema } from './financial-schemas';
import { OperationalSettingsService } from '../configuracoes/operational-settings-service';
import { AuthorizationType } from '@prisma/client';
import { authorizationService } from '../auth/authorization-service';

// =============================================================================
// CASH REGISTER SERVICE — Serviço de Caixa
// Regras:
//   - Apenas 1 caixa aberto por empresa (Fase 5)
//   - Não permitir fechar caixa já fechado
//   - Não permitir movimentar caixa fechado
//   - Toda operação gera CashMovement + ActivityLog + atualiza BankAccount
// =============================================================================

export async function getCurrentOpenRegister() {
  const session = await requirePermission('CAIXA', 'VIEW');
  try {
    const register = await prisma.cashRegister.findFirst({
      where: { companyId: session.companyId, status: 'OPEN' },
      include: {
        bankAccount: true,
        openedBy: { select: { id: true, name: true, cargo: true } },
        movements: { orderBy: { createdAt: 'asc' } },
      },
    });
    return { success: true, data: serializePrisma(register) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCashRegisters(limit = 30) {
  const session = await requirePermission('CAIXA', 'VIEW');
  try {
    const registers = await prisma.cashRegister.findMany({
      where: { companyId: session.companyId },
      include: {
        bankAccount: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        _count: { select: { transactions: true, movements: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
    return { success: true, data: serializePrisma(registers) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function openCashRegister(input: any) {
  const session = await requirePermission('CAIXA', 'CREATE');
  const parsed = CashRegisterOpenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verificar se já existe caixa aberto para esta empresa
      const existingOpen = await tx.cashRegister.findFirst({
        where: { companyId: session.companyId, status: 'OPEN' },
      });
      if (existingOpen) {
        throw new Error('Já existe um caixa aberto. Feche o caixa atual antes de abrir um novo.');
      }

      // Verificar se a conta bancária existe e pertence à empresa
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: parsed.data.bankAccountId, companyId: session.companyId, isActive: true },
      });
      if (!bankAccount) throw new Error('Conta bancária não encontrada ou inativa.');

      // Criar o caixa
      const register = await tx.cashRegister.create({
        data: {
          companyId: session.companyId,
          openedByUserId: session.userId,
          bankAccountId: parsed.data.bankAccountId,
          openingBalance: new Prisma.Decimal(parsed.data.openingBalance ?? 0),
          terminalId: parsed.data.terminalId || null,
          deviceId: parsed.data.deviceId || null,
          notes: parsed.data.notes || null,
          status: 'OPEN',
        },
      });

      // Registrar movimento de abertura
      await tx.cashMovement.create({
        data: {
          companyId: session.companyId,
          cashRegisterId: register.id,
          type: 'ABERTURA',
          amount: new Prisma.Decimal(parsed.data.openingBalance ?? 0),
          description: `Abertura de caixa com saldo inicial de R$ ${parsed.data.openingBalance ?? 0}`,
          createdByUserId: session.userId,
        },
      });

      return register;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CRIAR',
      module: 'CAIXA',
      recordId: result.id,
      details: `Caixa aberto com saldo inicial de R$ ${result.openingBalance}.`,
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    console.error('Error opening cash register:', error);
    return { success: false, error: error.message };
  }
}

export async function closeCashRegister(registerId: string, input: any) {
  const session = await requirePermission('CAIXA', 'UPDATE');
  const parsed = CashRegisterCloseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.findFirst({
        where: { id: registerId, companyId: session.companyId },
        include: { movements: true },
      });

      if (!register) throw new Error('Caixa não encontrado.');
      if (register.status === 'CLOSED') throw new Error('Este caixa já está fechado.');
      if (register.status === 'SUSPENDED') throw new Error('Este caixa está suspenso e não pode ser fechado diretamente.');

      // Calcular saldo esperado: abertura + reforços - sangrias
      let expectedBalance = Number(register.openingBalance);
      for (const mov of register.movements) {
        if (mov.type === 'REFORCO') expectedBalance += Number(mov.amount);
        if (mov.type === 'SANGRIA') expectedBalance -= Number(mov.amount);
      }

      // Soma das transações IN/OUT do caixa
      const [inSum, outSum] = await Promise.all([
        tx.financialTransaction.aggregate({
          where: { cashRegisterId: registerId, direction: 'IN', status: 'PAID' },
          _sum: { amount: true },
        }),
        tx.financialTransaction.aggregate({
          where: { cashRegisterId: registerId, direction: 'OUT', status: 'PAID' },
          _sum: { amount: true },
        }),
      ]);

      expectedBalance += Number(inSum._sum.amount ?? 0) - Number(outSum._sum.amount ?? 0);
      const difference = parsed.data.closingBalance - expectedBalance;

      const updated = await tx.cashRegister.update({
        where: { id: registerId },
        data: {
          status: 'CLOSED',
          closedByUserId: session.userId,
          closedAt: new Date(),
          closingBalance: new Prisma.Decimal(parsed.data.closingBalance),
          expectedBalance: new Prisma.Decimal(expectedBalance),
          difference: new Prisma.Decimal(difference),
          notes: parsed.data.notes || register.notes,
        },
      });

      // Registrar movimento de fechamento
      await tx.cashMovement.create({
        data: {
          companyId: session.companyId,
          cashRegisterId: registerId,
          type: 'FECHAMENTO',
          amount: new Prisma.Decimal(parsed.data.closingBalance),
          description: `Fechamento de caixa. Esperado: R$ ${expectedBalance.toFixed(2)} | Real: R$ ${parsed.data.closingBalance} | Diferença: R$ ${difference.toFixed(2)}`,
          createdByUserId: session.userId,
        },
      });

      return updated;
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'FECHAR',
      module: 'CAIXA',
      recordId: registerId,
      details: `Caixa fechado. Saldo real: R$ ${result.closingBalance} | Esperado: R$ ${result.expectedBalance} | Diferença: R$ ${result.difference}.`,
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    console.error('Error closing cash register:', error);
    return { success: false, error: error.message };
  }
}

export async function addCashMovement(input: any) {
  const session = await requirePermission('CAIXA', 'UPDATE');
  const parsed = CashMovementSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const typeLabel = parsed.data.type === 'REFORCO' ? 'Reforço' : parsed.data.type === 'SANGRIA' ? 'Sangria' : 'Ajuste';

  try {
    const movement = await prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.findFirst({
        where: { id: parsed.data.cashRegisterId, companyId: session.companyId },
      });

      if (!register) throw new Error('Caixa não encontrado.');
      if (register.status !== 'OPEN') throw new Error('Operação não permitida: caixa não está aberto.');

      // Validar políticas operacionais de sangria/reforço
      const settings = await OperationalSettingsService.getOrCreateOperationalSettings(session.companyId, tx);
      if (parsed.data.type === 'SANGRIA' && !settings.allowCashWithdrawal) {
        if (input.authorizationId) {
          const auth = await tx.actionAuthorization.findUnique({ where: { id: input.authorizationId } });
          if (!auth || auth.status !== 'APPROVED') {
            throw new Error('Autorização de sangria inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: session.companyId,
            type: AuthorizationType.CASH_WITHDRAWAL,
            module: 'CAIXA',
            requestedByUserId: session.userId,
            referenceId: register.id,
            referenceModule: 'CASH_REGISTER',
            amount: parsed.data.amount,
            reason: parsed.data.description || 'Sangria de Caixa',
            financialImpact: true,
          });
          return { requireAuthorization: true, authorizationId: authReq.id };
        }
      }
      if (parsed.data.type === 'REFORCO' && !settings.allowCashSupply) {
        if (input.authorizationId) {
          const auth = await tx.actionAuthorization.findUnique({ where: { id: input.authorizationId } });
          if (!auth || auth.status !== 'APPROVED') {
            throw new Error('Autorização de reforço inválida ou não aprovada.');
          }
        } else {
          const authReq = await authorizationService.createAuthorizationRequest({
            companyId: session.companyId,
            type: AuthorizationType.CASH_SUPPLY,
            module: 'CAIXA',
            requestedByUserId: session.userId,
            referenceId: register.id,
            referenceModule: 'CASH_REGISTER',
            amount: parsed.data.amount,
            reason: parsed.data.description || 'Reforço de Caixa',
            financialImpact: true,
          });
          return { requireAuthorization: true, authorizationId: authReq.id };
        }
      }

      const mov = await tx.cashMovement.create({
        data: {
          companyId: session.companyId,
          cashRegisterId: parsed.data.cashRegisterId,
          type: parsed.data.type,
          amount: new Prisma.Decimal(parsed.data.amount),
          description: parsed.data.description || `${typeLabel} de R$ ${parsed.data.amount}`,
          createdByUserId: session.userId,
        },
      });

      // Atualizar saldo da conta bancária associada ao caixa
      const balanceDelta = parsed.data.type === 'REFORCO' ? parsed.data.amount : -parsed.data.amount;
      await tx.bankAccount.update({
        where: { id: register.bankAccountId },
        data: { currentBalance: { increment: new Prisma.Decimal(balanceDelta) } },
      });

      return mov;
    });

    // if inner transaction returns an object with requireAuthorization, return it directly
    if (movement && 'requireAuthorization' in movement) {
      return movement;
    }

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: parsed.data.type,
      module: 'CAIXA',
      recordId: parsed.data.cashRegisterId,
      details: `${typeLabel} de R$ ${parsed.data.amount} realizado no caixa.`,
    });

    return { success: true, data: serializePrisma(movement) };
  } catch (error: any) {
    console.error('Error adding cash movement:', error);
    return { success: false, error: error.message };
  }
}

export async function getCashRegisterMovements(cashRegisterId: string) {
  const session = await requirePermission('CAIXA', 'VIEW');
  try {
    const movements = await prisma.cashMovement.findMany({
      where: { cashRegisterId, companyId: session.companyId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, data: serializePrisma(movements) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
