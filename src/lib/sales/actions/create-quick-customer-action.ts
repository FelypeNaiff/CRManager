'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAllPermissions } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { serializePrisma } from '@/lib/serialize';

export const QuickCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(150),
  phone: z.string().trim().min(8, 'Informe um telefone válido.').max(30),
  children: z.array(z.object({
    name: z.string().trim().min(2, 'Informe o nome da criança.').max(150),
    age: z.number().int().min(0, 'Idade inválida.').max(25, 'Idade inválida.'),
  })).min(1, 'Informe pelo menos uma criança.').max(10),
});

export type QuickCustomerInput = z.infer<typeof QuickCustomerSchema>;

function birthDateForAge(age: number, referenceDate = new Date()) {
  const birthDate = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  ));
  birthDate.setUTCFullYear(birthDate.getUTCFullYear() - age);
  return birthDate;
}

export async function createQuickCustomerAction(rawInput: QuickCustomerInput) {
  try {
    const session = await requireAllPermissions([
      { module: 'CLIENTES', action: 'CREATE' },
      { module: 'FILHOS', action: 'CREATE' },
    ]);
    const input = QuickCustomerSchema.parse(rawInput);

    const customer = await prisma.$transaction(async tx => {
      const existing = await tx.customer.findFirst({
        where: { companyId: session.companyId, phone: input.phone },
        select: { id: true },
      });
      if (existing) throw new Error('PHONE_ALREADY_EXISTS');

      const created = await tx.customer.create({
        data: {
          companyId: session.companyId,
          name: input.name,
          phone: input.phone,
          status: 'ativo',
          children: {
            create: input.children.map(child => ({
              name: child.name,
              birthDate: birthDateForAge(child.age),
            })),
          },
        },
        include: { children: true, wallet: true },
      });

      await tx.customerHistory.create({
        data: {
          customerId: created.id,
          actionType: 'CADASTRO',
          description: `Cliente e ${created.children.length} dependente(s) cadastrados no PDV por ${session.name}`,
        },
      });

      await writeActivityLog({
        context: session,
        action: 'CUSTOMER_CREATE',
        module: 'CUSTOMERS',
        recordId: created.id,
        details: 'Cliente criado pelo cadastro rápido do PDV.',
        metadata: { status: created.status, childCount: created.children.length, source: 'PDV_QUICK_CREATE' },
      }, { policy: 'CRITICAL', tx });

      for (const child of created.children) {
        await writeActivityLog({
          context: session,
          action: 'CUSTOMER_CHILD_CREATE',
          module: 'CUSTOMER_CHILDREN',
          recordId: child.id,
          details: 'Dependente criado pelo cadastro rápido do PDV.',
          metadata: { customerId: created.id, source: 'PDV_QUICK_CREATE' },
        }, { policy: 'CRITICAL', tx });
      }

      return created;
    });

    return { success: true, customer: serializePrisma(customer) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Dados inválidos.' };
    }
    if (error instanceof Error && error.message === 'PHONE_ALREADY_EXISTS') {
      return { success: false, error: 'Este telefone já está cadastrado.' };
    }
    return { success: false, error: 'Não foi possível cadastrar o cliente.' };
  }
}
