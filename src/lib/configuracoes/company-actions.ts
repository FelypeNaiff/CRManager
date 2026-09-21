'use server';
import { serializePrisma } from '@/lib/serialize';

import { CompanyService, CompanyDataInput } from './company-service';
import { requirePermission } from '@/lib/auth/permissions';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { addAuditChange, type AuditChanges } from '@/lib/auth/audit-changes';
import { prisma } from '@/lib/prisma';
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
  const session = await requirePermission('CONFIGURACOES_EMPRESA', 'VIEW');
  try {
    const company = await CompanyService.getActiveCompany(session.companyId);
    return { success: true, data: serializePrisma(company) };
  } catch {
    return { success: false, error: 'Erro ao buscar dados da empresa.' };
  }
}

/**
 * Action to update company data and log activity.
 */
export async function updateCompanyAction(rawData: any, updateType?: 'contatos' | 'enderecos' | 'fiscal' | 'financeiro-fiscal' | 'gerais') {
  const session = await requirePermission('CONFIGURACOES_EMPRESA', 'UPDATE');
  try {
    const validatedData = CompanyFormSchema.parse(rawData);

    const updatedCompany = await prisma.$transaction(async tx => {
      const before = await tx.company.findUnique({ where: { id: session.companyId } });
      if (!before) throw new Error('Empresa não encontrada.');
      const updated = await CompanyService.updateCompanyData(session.companyId, validatedData as CompanyDataInput, tx);
      const changes: AuditChanges = {};
      for (const field of ['nomeFantasia', 'status', 'regimeTributario', 'crt', 'cnae', 'uf', 'cidade', 'regimeApuracao', 'naturezaReceitaPadrao', 'naturezaDespesaPadrao', 'pixTipo'] as const) {
        addAuditChange(changes, field, before[field], updated[field]);
      }
      if (Object.keys(changes).length > 0) await writeActivityLog({
        context: session,
        action: updateType === 'financeiro-fiscal' ? 'FINANCIAL_SETTINGS_UPDATE' : 'COMPANY_UPDATE',
        module: updateType === 'financeiro-fiscal' ? 'FINANCIAL_SETTINGS' : 'COMPANY_SETTINGS',
        recordId: updated.id,
        details: updateType === 'financeiro-fiscal' ? 'Parâmetros financeiro-fiscais atualizados.' : 'Dados da empresa atualizados.',
        metadata: { section: updateType ?? 'company', changes },
      }, { policy: 'CRITICAL', tx });
      return updated;
    });

    return { success: true, data: serializePrisma(updatedCompany) };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: `Dados inválidos: ${fieldErrors}` };
    }
    return { success: false, error: 'Erro ao salvar dados da empresa.' };
  }
}
