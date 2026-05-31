import { prisma } from '@/lib/prisma';
import { getActiveProfileSession } from '@/lib/auth/actions';

export interface CompanyDataInput {
  razaoSocial: string;
  nomeFantasia: string;
  cnpjCpf: string;
  inscricaoEstadual?: string | null;
  inscricaoMunicipal?: string | null;
  regimeTributario?: string | null;
  crt?: string | null;
  cnae?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  nomeExibido?: string | null;
  observacoes?: string | null;
  status?: string;
}

/**
 * Service to manage company master data in PostgreSQL via Prisma.
 */
export const CompanyService = {
  /**
   * Retrieves the active company based on the current profile session.
   */
  async getActiveCompany() {
    const session = await getActiveProfileSession();
    if (!session) {
      throw new Error('Usuário não autenticado ou sessão de perfil inválida.');
    }

    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
    });

    return company;
  },

  /**
   * Updates an existing company's data.
   */
  async updateCompanyData(companyId: string, data: CompanyDataInput) {
    if (!companyId) {
      throw new Error('ID da empresa é obrigatório.');
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpjCpf: data.cnpjCpf,
        inscricaoEstadual: data.inscricaoEstadual ?? null,
        inscricaoMunicipal: data.inscricaoMunicipal ?? null,
        regimeTributario: data.regimeTributario ?? null,
        crt: data.crt ?? null,
        cnae: data.cnae ?? null,
        telefone: data.telefone ?? null,
        whatsapp: data.whatsapp ?? null,
        email: data.email ?? null,
        site: data.site ?? null,
        cep: data.cep ?? null,
        logradouro: data.logradouro ?? null,
        numero: data.numero ?? null,
        complemento: data.complemento ?? null,
        bairro: data.bairro ?? null,
        cidade: data.cidade ?? null,
        uf: data.uf ?? null,
        nomeExibido: data.nomeExibido ?? null,
        observacoes: data.observacoes ?? null,
        status: data.status ?? 'ativo',
      },
    });

    return updatedCompany;
  },

  /**
   * Creates or updates company data.
   */
  async upsertCompanyData(companyId: string, data: CompanyDataInput) {
    if (!companyId) {
      throw new Error('ID da empresa é obrigatório para upsert.');
    }

    const upsertedCompany = await prisma.company.upsert({
      where: { id: companyId },
      update: {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpjCpf: data.cnpjCpf,
        inscricaoEstadual: data.inscricaoEstadual ?? null,
        inscricaoMunicipal: data.inscricaoMunicipal ?? null,
        regimeTributario: data.regimeTributario ?? null,
        crt: data.crt ?? null,
        cnae: data.cnae ?? null,
        telefone: data.telefone ?? null,
        whatsapp: data.whatsapp ?? null,
        email: data.email ?? null,
        site: data.site ?? null,
        cep: data.cep ?? null,
        logradouro: data.logradouro ?? null,
        numero: data.numero ?? null,
        complemento: data.complemento ?? null,
        bairro: data.bairro ?? null,
        cidade: data.cidade ?? null,
        uf: data.uf ?? null,
        nomeExibido: data.nomeExibido ?? null,
        observacoes: data.observacoes ?? null,
        status: data.status ?? 'ativo',
      },
      create: {
        id: companyId,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpjCpf: data.cnpjCpf,
        inscricaoEstadual: data.inscricaoEstadual ?? null,
        inscricaoMunicipal: data.inscricaoMunicipal ?? null,
        regimeTributario: data.regimeTributario ?? null,
        crt: data.crt ?? null,
        cnae: data.cnae ?? null,
        telefone: data.telefone ?? null,
        whatsapp: data.whatsapp ?? null,
        email: data.email ?? null,
        site: data.site ?? null,
        cep: data.cep ?? null,
        logradouro: data.logradouro ?? null,
        numero: data.numero ?? null,
        complemento: data.complemento ?? null,
        bairro: data.bairro ?? null,
        cidade: data.cidade ?? null,
        uf: data.uf ?? null,
        nomeExibido: data.nomeExibido ?? null,
        observacoes: data.observacoes ?? null,
        status: data.status ?? 'ativo',
      },
    });

    return upsertedCompany;
  },
};
