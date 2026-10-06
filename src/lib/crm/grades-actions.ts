'use server';

import { serializePrisma } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { tenantWhere } from './tenant-security';
import { publicActionError } from '@/lib/auth/public-action-error';
import { writeActivityLog } from '@/lib/auth/activity-log';

export async function getProductGrades() {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const grades = await prisma.productGrade.findMany({
      where: { companyId: session.companyId, isActive: true },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(grades) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar grades.') };
  }
}

export async function getProductGradeById(id: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const grade = await prisma.productGrade.findFirst({
      where: tenantWhere(id, session.companyId),
      include: {
        options: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!grade) {
      return { success: false, error: 'Grade não encontrada.' };
    }
    return { success: true, data: serializePrisma(grade) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar grade.') };
  }
}

export async function createProductGrade(input: { name: string; options: string[] }) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'O nome da grade é obrigatório.' };
    }
    if (!input.options || input.options.length === 0) {
      return { success: false, error: 'Informe ao menos uma variação para a grade.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.productGrade.findFirst({
        where: { companyId: session.companyId, name: input.name, isActive: true },
      });
      if (existing) {
        throw new Error('Já existe uma grade ativa com este nome.');
      }

      const grade = await tx.productGrade.create({
        data: {
          companyId: session.companyId,
          name: input.name,
          options: {
            create: input.options.map((opt, idx) => ({
              companyId: session.companyId,
              name: opt,
              order: idx,
            })),
          },
        },
      });

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_GRADE_CREATE',
        module: 'PRODUCTS',
        recordId: grade.id,
        details: `Grade "${grade.name}" criada com ${input.options.length} opções.`,
      }, { policy: 'CRITICAL', tx });

      return grade;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao criar grade.') };
  }
}

export async function updateProductGrade(id: string, input: { name: string; options: string[] }) {
  const session = await requirePermission('PRODUTOS', 'UPDATE');
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'O nome da grade é obrigatório.' };
    }
    if (!input.options || input.options.length === 0) {
      return { success: false, error: 'Informe ao menos uma variação para a grade.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const grade = await tx.productGrade.findFirst({
        where: tenantWhere(id, session.companyId),
        include: { options: { where: { isActive: true } } },
      });
      if (!grade) {
        throw new Error('Grade não encontrada.');
      }

      // Update name if changed
      if (grade.name !== input.name) {
        const existing = await tx.productGrade.findFirst({
          where: { companyId: session.companyId, name: input.name, isActive: true, id: { not: id } },
        });
        if (existing) throw new Error('Já existe outra grade ativa com este nome.');

        await tx.productGrade.update({
          where: { id },
          data: { name: input.name },
        });
      }

      // Sync options
      const existingOptions = grade.options.map(o => o.name);
      const newOptions = input.options;

      const toRemove = grade.options.filter(o => !newOptions.includes(o.name));
      const toAdd = newOptions.filter(opt => !existingOptions.includes(opt));
      
      if (toRemove.length > 0) {
        await tx.productGradeOption.updateMany({
          where: { id: { in: toRemove.map(o => o.id) } },
          data: { isActive: false },
        });
      }

      // Add new options and update orders
      for (let i = 0; i < newOptions.length; i++) {
        const optName = newOptions[i];
        const existingOpt = grade.options.find(o => o.name === optName);
        if (existingOpt) {
          if (existingOpt.order !== i) {
            await tx.productGradeOption.update({
              where: { id: existingOpt.id },
              data: { order: i },
            });
          }
        } else {
          await tx.productGradeOption.create({
            data: {
              companyId: session.companyId,
              gradeId: id,
              name: optName,
              order: i,
            },
          });
        }
      }

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_GRADE_UPDATE',
        module: 'PRODUCTS',
        recordId: id,
        details: `Grade "${input.name}" atualizada.`,
      }, { policy: 'CRITICAL', tx });

      return true;
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao atualizar grade.') };
  }
}

export async function deleteProductGrade(id: string) {
  const session = await requirePermission('PRODUTOS', 'DELETE');
  try {
    await prisma.$transaction(async (tx) => {
      const grade = await tx.productGrade.findFirst({
        where: tenantWhere(id, session.companyId),
      });
      if (!grade) {
        throw new Error('Grade não encontrada.');
      }

      await tx.productGrade.update({
        where: { id },
        data: { isActive: false },
      });
      
      await tx.productGradeOption.updateMany({
        where: { gradeId: id, companyId: session.companyId },
        data: { isActive: false },
      });

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_GRADE_DELETE',
        module: 'PRODUCTS',
        recordId: id,
        details: `Grade "${grade.name}" inativada.`,
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao excluir grade.') };
  }
}
