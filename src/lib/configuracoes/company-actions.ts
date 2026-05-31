'use server';

import { CompanyService, CompanyDataInput } from './company-service';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { z } from 'zod';

const CompanyFormSchema = z.object({
  razaoSocial: z.string().min(2, 'Razão Social inválida (mínimo 2 caracteres)'),
  nomeFantasia: z.string().min(2, 'Nome Fantasia inválido (mínimo 2 caracteres)'),
  cnpjCpf: z.string().min(11, 'CNPJ/CPF inválido (mínimo 11 caracteres)'),
  inscricaoEstadual: z.string().optional().nullable().or(z.literal('')),
  inscricaoMunicipal: z.string().optional().nullable().or(z.literal('')),
  regimeTributario: z.string().optional().nullable().or(z.literal('')),
  crt: z.string().optional().nullable().or(z.literal('')),
  cnae: z.string().optional().nullable().or(z.literal('')),
  telefone: z.string().optional().nullable().or(z.literal('')),
  whatsapp: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  site: z.string().optional().nullable().or(z.literal('')),
  cep: z.string().optional().nullable().or(z.literal('')),
  logradouro: z.string().optional().nullable().or(z.literal('')),
  numero: z.string().optional().nullable().or(z.literal('')),
  complemento: z.string().optional().nullable().or(z.literal('')),
  bairro: z.string().optional().nullable().or(z.literal('')),
  cidade: z.string().optional().nullable().or(z.literal('')),
  uf: z.string().optional().nullable().or(z.literal('')),
  nomeExibido: z.string().optional().nullable().or(z.literal('')),
  observacoes: z.string().optional().nullable().or(z.literal('')),
  status: z.string().default('ativo'),
});

/**
 * Action to fetch the active company data.
 */
export async function getCompanyAction() {
  const session = await requirePermission('Configurações gerais', 'visualizar');
  try {
    const company = await CompanyService.getActiveCompany();
    return { success: true, data: company };
  } catch (error: any) {
    console.error('Error in getCompanyAction:', error);
    return { success: false, error: error.message || 'Erro ao buscar dados da empresa.' };
  }
}

/**
 * Action to update company data and log activity.
 */
export async function updateCompanyAction(rawData: any) {
  const session = await requirePermission('Configurações gerais', 'editar');
  try {
    const validatedData = CompanyFormSchema.parse(rawData);

    // Call service to update
    const updatedCompany = await CompanyService.updateCompanyData(
      session.companyId,
      validatedData as CompanyDataInput
    );

    // Record activity log
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: 'Minha Empresa',
      recordId: updatedCompany.id,
      details: `Atualizou os dados da empresa. Razão Social: ${updatedCompany.razaoSocial}, Fantasia: ${updatedCompany.nomeFantasia}`,
    });

    return { success: true, data: updatedCompany };
  } catch (error: any) {
    console.error('Error in updateCompanyAction:', error);
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: `Dados inválidos: ${fieldErrors}` };
    }
    return { success: false, error: error.message || 'Erro ao salvar dados da empresa.' };
  }
}
