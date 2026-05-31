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
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')).or(z.null()),
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
  regimeApuracao: z.string().optional().nullable().or(z.literal('')),
  naturezaReceitaPadrao: z.string().optional().nullable().or(z.literal('')),
  naturezaDespesaPadrao: z.string().optional().nullable().or(z.literal('')),
  observacoesFiscais: z.string().optional().nullable().or(z.literal('')),
  pixChave: z.string().optional().nullable().or(z.literal('')),
  pixTipo: z.string().optional().nullable().or(z.literal('')),
  bancoPrincipal: z.string().optional().nullable().or(z.literal('')),
  agenciaPrincipal: z.string().optional().nullable().or(z.literal('')),
  contaPrincipal: z.string().optional().nullable().or(z.literal('')),
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
export async function updateCompanyAction(rawData: any, updateType?: 'contatos' | 'enderecos' | 'fiscal' | 'financeiro-fiscal' | 'gerais') {
  const session = await requirePermission('Configurações gerais', 'editar');
  try {
    const validatedData = CompanyFormSchema.parse(rawData);

    // Call service to update
    const updatedCompany = await CompanyService.updateCompanyData(
      session.companyId,
      validatedData as CompanyDataInput
    );

    // Determine audit details and module
    let logModule = 'Minha Empresa';
    let logDetails = `Atualizou os dados da empresa. Razão Social: ${updatedCompany.razaoSocial}, Fantasia: ${updatedCompany.nomeFantasia}`;

    if (updateType === 'contatos') {
      logModule = 'CONFIGURACOES';
      logDetails = 'Atualização dos contatos da empresa';
    } else if (updateType === 'enderecos') {
      logModule = 'CONFIGURACOES';
      logDetails = 'Atualização do endereço da empresa';
    } else if (updateType === 'fiscal') {
      logModule = 'CONFIGURACOES';
      logDetails = 'Atualização dos dados fiscais da empresa';
    } else if (updateType === 'financeiro-fiscal') {
      logModule = 'CONFIGURACOES';
      logDetails = 'Atualização dos parâmetros financeiro-fiscais da empresa';
    }

    // Record activity log
    await writeActivityLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      module: logModule,
      recordId: updatedCompany.id,
      details: logDetails,
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
