'use server';
import { serializePrisma } from '@/lib/serialize';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { hashPin, generateTemporaryPin, validatePin } from '@/lib/auth/pin-service';
import { z } from 'zod';

const UserCreateSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório (mínimo 2 caracteres)'),
  email: z.string().email('E-mail inválido'),
  cargo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  commissionRate: z.number().min(0).max(100).default(0),
  maxDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  pin: z.string().min(4, 'PIN deve conter no mínimo 4 dígitos').max(8, 'PIN deve conter no máximo 8 dígitos').optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const UserUpdateSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório (mínimo 2 caracteres)').optional(),
  cargo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

/**
 * Fetch all users for the active company
 */
export async function getUsersAction() {
  const session = await requirePermission('USUARIOS', 'VIEW');
  try {
    const users = await prisma.user.findMany({
      where: { companyId: session.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        cargo: true,
        commissionRate: true,
        maxDiscountPercentage: true,
        updatedAt: true,
        role: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(users) };
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return { success: false, error: 'Erro ao buscar usuários.' };
  }
}

/**
 * Fetch a single user by ID
 */
export async function getUserByIdAction(id: string) {
  const session = await requirePermission('USUARIOS', 'VIEW');
  try {
    const user = await prisma.user.findFirst({
      where: { id, companyId: session.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        cargo: true,
        commissionRate: true,
        maxDiscountPercentage: true,
        updatedAt: true,
        roleId: true,
      }
    });
    
    if (!user) {
      return { success: false, error: 'Usuário não encontrado.' };
    }
    
    return { success: true, data: serializePrisma(user) };
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return { success: false, error: 'Erro ao buscar usuário.' };
  }
}

/**
 * Create a new user
 */
export async function createUserAction(rawData: any) {
  const session = await requirePermission('USUARIOS', 'CREATE');
  try {
    const validatedData = UserCreateSchema.parse(rawData);

    // Check if email already exists globally
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return { success: false, error: 'Este e-mail já está em uso.' };
    }

    let authorizationPinHash = null;
    if (validatedData.pin) {
      authorizationPinHash = await hashPin(validatedData.pin);
    }

    const newUser = await prisma.user.create({
      data: {
        companyId: session.companyId,
        name: validatedData.name,
        email: validatedData.email,
        cargo: validatedData.cargo,
        status: validatedData.status,
        commissionRate: validatedData.commissionRate,
        maxDiscountPercentage: validatedData.maxDiscountPercentage,
        authorizationPinHash,
        pinAccessHash: 'N/A', // Placeholder since login is not fully managed here yet according to requirements
        permitirAcesso: validatedData.status === 'ACTIVE',
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      module: 'USUARIOS',
      recordId: newUser.id,
      details: `Criou o usuário: ${newUser.name} (${newUser.email})`,
    });

    return { success: true, data: { id: newUser.id } };
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    return { success: false, error: 'Erro ao criar usuário.' };
  }
}

/**
 * Update an existing user
 */
export async function updateUserAction(id: string, rawData: any) {
  const session = await requirePermission('USUARIOS', 'UPDATE');
  try {
    const validatedData = UserUpdateSchema.parse(rawData);

    const existingUser = await prisma.user.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!existingUser) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: validatedData.name,
        cargo: validatedData.cargo,
        status: validatedData.status,
        permitirAcesso: validatedData.status === 'ACTIVE' ? true : existingUser.permitirAcesso,
        commissionRate: validatedData.commissionRate,
        maxDiscountPercentage: validatedData.maxDiscountPercentage,
      },
    });

    let details = `Atualizou dados do usuário: ${updatedUser.name}.`;
    if (existingUser.status !== updatedUser.status) {
      details += ` Status alterado para ${updatedUser.status}.`;
    }

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'USUARIOS',
      recordId: updatedUser.id,
      details,
    });

    return { success: true, data: { id: updatedUser.id } };
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos. Verifique os campos preenchidos.' };
    }
    return { success: false, error: 'Erro ao atualizar usuário.' };
  }
}

/**
 * Reset a user's authorization PIN (by admin)
 */
export async function resetUserPinAction(userId: string) {
  const session = await requirePermission('USUARIOS', 'UPDATE'); // Requires manage permissions
  try {
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, companyId: session.companyId },
    });

    if (!existingUser) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const tempPin = generateTemporaryPin();
    const hash = await hashPin(tempPin);

    await prisma.user.update({
      where: { id: userId },
      data: {
        authorizationPinHash: hash,
        pinResetRequired: true,
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'USUARIOS',
      recordId: userId,
      details: `Resetou o PIN de autorização para o usuário: ${existingUser.name}.`,
    });

    // The temporary PIN is returned ONCE to the frontend so the admin can copy it and give it to the user.
    // It is NEVER returned again.
    return { success: true, tempPin };
  } catch (error: any) {
    console.error('Error resetting user PIN:', error);
    return { success: false, error: 'Erro ao resetar o PIN do usuário.' };
  }
}

/**
 * Change a user's authorization PIN (by the user themselves)
 */
export async function changeUserPinAction(userId: string, currentPin: string, newPin: string) {
  // Normally we would get the user id from the session (the user changing their own pin)
  // For the sake of this config flow, if an admin is forcing the change, they can provide it.
  const session = await requirePermission('USUARIOS', 'UPDATE'); 
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId: session.companyId },
    });

    if (!user) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    if (!user.authorizationPinHash) {
      return { success: false, error: 'O usuário não possui um PIN cadastrado para alterar. Solicite um reset.' };
    }

    const isValid = await validatePin(currentPin, user.authorizationPinHash);
    if (!isValid) {
      return { success: false, error: 'PIN atual inválido.' };
    }

    if (!newPin || newPin.length < 4 || newPin.length > 8) {
      return { success: false, error: 'Novo PIN deve ter entre 4 e 8 dígitos.' };
    }

    const newHash = await hashPin(newPin);

    await prisma.user.update({
      where: { id: userId },
      data: {
        authorizationPinHash: newHash,
        pinResetRequired: false,
        pinLastChangedAt: new Date(),
      },
    });

    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId, // whoever performed the action
      action: 'UPDATE',
      module: 'USUARIOS',
      recordId: userId,
      details: `Alterou o próprio PIN de autorização.`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error changing user PIN:', error);
    return { success: false, error: 'Erro ao alterar o PIN de autorização.' };
  }
}
