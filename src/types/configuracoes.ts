import { z } from "zod";

// ============================================================================
// BASE SCHEMA (Campos obrigatórios para todas as collections de configuração)
// ============================================================================
const baseConfigSchema = z.object({
  id: z.string().optional(),
  empresa_id: z.string().min(1, "Empresa ID é obrigatório"),
  criado_em: z.any().optional(), // Aceita Timestamp do Firebase Firestore
  atualizado_em: z.any().optional(),
  atualizado_por: z.string().optional(),
});

// ============================================================================
// SCHEMAS E TYPES: CONFIGURAÇÕES GERAIS E EMPRESA
// ============================================================================

export const minhaEmpresaSchema = baseConfigSchema.extend({
  tipo_pessoa: z.enum(["PJ", "PF"]).default("PJ"),
  razao_social: z.string().min(1, "Razão Social é obrigatória"),
  nome_fantasia: z.string().min(1, "Nome Fantasia é obrigatório"),
  cnpj_cpf: z.string().min(11, "Documento inválido"),
  inscricao_estadual: z.string().optional(),
  ie_isento: z.boolean().default(false),
  inscricao_municipal: z.string().optional(),
  cnae_principal: z.string().optional(),
  regime_tributario: z.string().optional(),
  regime_especial_tributacao: z.string().optional(),
  
  ie_substitutos: z.array(z.object({
    uf: z.string(),
    inscricao: z.string()
  })).optional().default([]),

  telefone: z.string().optional(),
  celular: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  site: z.string().optional(),
  instagram: z.string().optional(),

  endereco: z.object({
    cep: z.string().optional(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    pais: z.string().default("Brasil")
  }).optional(),
  
  // Branding
  logo_url: z.string().url("URL da logo inválida").optional().or(z.literal("")),
  logo_reduzida: z.string().url("URL inválida").optional().or(z.literal("")),
  favicon: z.string().url("URL inválida").optional().or(z.literal("")),
  cor_primaria: z.string().optional(),
  cor_secundaria: z.string().optional(),
  imagem_login: z.string().url("URL inválida").optional().or(z.literal("")),

  // Filiais
  filiais: z.array(z.object({
    id: z.string().optional(),
    nome_filial: z.string().min(1, "Nome da filial obrigatório"),
    cnpj: z.string().optional(),
    codigo_interno: z.string().optional(),
    responsavel: z.string().optional(),
    telefone: z.string().optional(),
    endereco: z.string().optional(),
    estoque_separado: z.boolean().default(false),
    financeiro_separado: z.boolean().default(false),
    pdv_separado: z.boolean().default(false),
  })).optional().default([]),

  // Dados Complementares
  responsavel_legal: z.string().optional(),
  cpf_responsavel: z.string().optional(),
  email_financeiro: z.string().email("E-mail inválido").optional().or(z.literal("")),
  email_fiscal: z.string().email("E-mail inválido").optional().or(z.literal("")),
  observacoes_internas: z.string().optional(),
});
export type MinhaEmpresaConfig = z.infer<typeof minhaEmpresaSchema>;

export const configuracoesGeraisSchema = baseConfigSchema.extend({
  casas_decimais_valor: z.number().int().min(2).max(4).default(2),
  casas_decimais_quantidade: z.number().int().min(0).max(4).default(2),
  registros_por_pagina: z.number().int().min(10).max(100).default(50),
  estoque_produto_composicao: z.boolean().default(false), // true: controlar, false: não controlar
  permitir_venda_sem_estoque: z.boolean().default(false), // true: permitir, false: não permitir
  vender_sem_condicao_pagamento: z.boolean().default(false),
  atualizar_custo_compras: z.boolean().default(true),
  permitir_acesso_suporte: z.boolean().default(true),
  
  numeracoes: z.object({
    clientes: z.number().int().min(0).default(0),
    fornecedores: z.number().int().min(0).default(0),
    transportadoras: z.number().int().min(0).default(0),
    orcamentos: z.number().int().min(0).default(0),
    vendas: z.number().int().min(0).default(0),
    ordens_servicos: z.number().int().min(0).default(0),
    contrato: z.number().int().min(0).default(0),
    locacao: z.number().int().min(0).default(0),
    financeiro: z.number().int().min(0).default(0),
    nfe: z.number().int().min(0).default(0),
    nfce: z.number().int().min(0).default(0),
    rps_nfse: z.number().int().min(0).default(0),
    cotacao: z.number().int().min(0).default(0),
    compra: z.number().int().min(0).default(0),
    ajuste_estoque: z.number().int().min(0).default(0),
    atendimento: z.number().int().min(0).default(0),
    produtos: z.number().int().min(0).default(0),
    contas_pagar: z.number().int().min(0).default(0),
    contas_receber: z.number().int().min(0).default(0),
    pdv: z.number().int().min(0).default(0),
  }).optional().default({}),

  movimentacoes: z.object({
    formato_pedido_a4: z.enum(["PDF", "HTML"]).default("PDF"),
    tamanho_fonte_a4: z.string().default("Normal"),
    tamanho_fonte_cupom: z.string().default("Normal"),
    
    introducao_orcamento: z.string().optional(),
    observacoes_orcamento: z.string().optional(),
    exibir_orcamento: z.object({
      coluna_item: z.boolean().default(true),
      coluna_codigo: z.boolean().default(true),
      coluna_unidade: z.boolean().default(true),
      coluna_valor_unitario: z.boolean().default(true),
      coluna_subtotal: z.boolean().default(true),
      coluna_ncm: z.boolean().default(false),
      descricao_produto: z.boolean().default(true),
      imagem_produto: z.boolean().default(false),
      descricao_servico: z.boolean().default(true),
      imagem_servico: z.boolean().default(false),
    }).optional().default({}),

    observacoes_venda: z.string().optional(),
    exibir_venda: z.object({
      coluna_item: z.boolean().default(true),
      coluna_codigo: z.boolean().default(true),
      coluna_unidade: z.boolean().default(true),
      coluna_valor_unitario: z.boolean().default(true),
      coluna_subtotal: z.boolean().default(true),
      coluna_ncm: z.boolean().default(false),
      descricao_produto: z.boolean().default(true),
      imagem_produto: z.boolean().default(false),
      descricao_servico: z.boolean().default(true),
      imagem_servico: z.boolean().default(false),
    }).optional().default({}),

    habilitar_cupom_presente: z.boolean().default(false),
  }).optional().default({}),
});
export type ConfiguracoesGerais = z.infer<typeof configuracoesGeraisSchema>;

export const configuracoesPDVSchema = baseConfigSchema.extend({
  observacoes_faturas: z.string().optional(),
  
  emitir_nfce: z.enum(["DESABILITADO", "CONFIRMAR", "AUTOMATICO"]).default("DESABILITADO"),
  sempre_indicar_vendedor: z.boolean().default(false),
  sempre_indicar_cliente: z.boolean().default(false),
  adicionar_produto_automaticamente: z.boolean().default(true),
  exibir_fotos_carrinho: z.boolean().default(true),
  usar_balanca: z.enum(["NAO_UTILIZAR", "UTILIZAR"]).default("NAO_UTILIZAR"),
  habilitar_pix: z.boolean().default(true),
  texto_final_impressao: z.string().optional(),
  politica_troca: z.string().optional(),
  
  permitir_venda_sem_estoque: z.boolean().default(false),
  exigir_caixa_aberto: z.boolean().default(true),
  permitir_desconto: z.boolean().default(true),
  limite_maximo_desconto: z.number().min(0).max(100).default(10), // %
  permitir_venda_cliente_nao_identificado: z.boolean().default(true),

  impressora_padrao: z.string().default("NAO_DEFINIDA"),
  tamanho_cupom: z.string().default("80mm"),
  exibir_logo_cupom: z.boolean().default(true),
  exibir_endereco_cupom: z.boolean().default(true),
  exibir_telefone_cupom: z.boolean().default(true),
  exibir_vendedor_cupom: z.boolean().default(true),
  exibir_cliente_cupom: z.boolean().default(true),
});
export type ConfiguracoesPDV = z.infer<typeof configuracoesPDVSchema>;

export const configuracoesFiscalSchema = baseConfigSchema.extend({
  // NFe
  ultima_nfe: z.number().int().min(0).default(0),
  serie_nfe: z.number().int().min(0).default(1),
  ambiente_nfe: z.enum(["HOMOLOGACAO", "PRODUCAO"]).default("HOMOLOGACAO"),
  versao_nfe: z.string().default("4.00"),
  info_complementar_nfe: z.string().optional(),
  exibir_danfe_simplificado: z.boolean().default(false),
  
  // NFCe
  ultima_nfce: z.number().int().min(0).default(0),
  serie_nfce: z.number().int().min(0).default(1),
  ambiente_nfce: z.enum(["HOMOLOGACAO", "PRODUCAO"]).default("HOMOLOGACAO"),
  versao_nfce: z.string().default("4.00"),
  info_complementar_nfce: z.string().optional(),
  token_nfce: z.string().optional(),
  csc_nfce: z.string().optional(),

  // PIS/COFINS
  subtrair_icms_pis_cofins: z.boolean().default(false),
});
export type ConfiguracoesFiscal = z.infer<typeof configuracoesFiscalSchema>;

// ============================================================================
// SCHEMAS E TYPES: INFRAESTRUTURA EXTERNA (SMTP, DOMÍNIO E CERTIFICADOS)
// ============================================================================

export const configuracoesSMTPSchema = baseConfigSchema.extend({
  servidor: z.string().optional(),
  porta: z.number().optional(),
  usuario: z.string().optional(),
  senha: z.string().optional(), // Senha criptografada
  usa_ssl_tls: z.boolean().default(true),
  remetente_nome: z.string().optional(),
  remetente_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});
export type ConfiguracoesSMTP = z.infer<typeof configuracoesSMTPSchema>;

export const configuracoesDominioSchema = baseConfigSchema.extend({
  dominio: z.string().optional(),
  status_dns: z.enum(["PENDENTE", "VERIFICADO", "FALHA"]).default("PENDENTE"),
  cname_target: z.string().optional(),
});
export type ConfiguracoesDominio = z.infer<typeof configuracoesDominioSchema>;

export const certificadoDigitalSchema = baseConfigSchema.extend({
  tipo: z.enum(["A1", "A3"]).default("A1"),
  nome_certificado: z.string().optional(),
  cnpj_vinculado: z.string().optional(),
  validade_inicio: z.string().optional(),
  validade_fim: z.string().optional(),
  status: z.enum(["VALIDO", "EXPIRADO", "AVISO_VENCIMENTO", "PENDENTE"]).default("PENDENTE"),
  observacoes: z.string().optional(),
  nome_arquivo: z.string().optional(),
  caminho_storage: z.string().optional(),
  senha_certificado: z.string().optional(),
});
export type CertificadoDigital = z.infer<typeof certificadoDigitalSchema>;

// ============================================================================
// SCHEMAS E TYPES: USUÁRIOS E PERMISSÕES (RBAC)
// ============================================================================

export const usuarioSchema = baseConfigSchema.extend({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO", "BLOQUEADO"]).default("ATIVO"),
  grupo_id: z.string().optional(),
  permitir_acesso: z.boolean().default(true),
  pin_acesso: z.string().length(4, "PIN deve ter 4 dígitos").optional().default("1234"),
  observacoes: z.string().optional(),
  ultimo_acesso: z.string().optional(), // Pode ser Timestamp
});
export type Usuario = z.infer<typeof usuarioSchema>;

export const grupoUsuarioSchema = baseConfigSchema.extend({
  nome: z.string().min(1, "Nome do grupo é obrigatório"),
  descricao: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
  is_admin: z.boolean().default(false), // Flag para override de permissões (Root admin)
});
export type GrupoUsuario = z.infer<typeof grupoUsuarioSchema>;

export const permissoesSchema = baseConfigSchema.extend({
  grupo_id: z.string().min(1, "Grupo ID é obrigatório"),
  matriz: z.record(z.string(), z.record(z.string(), z.boolean())).optional().default({}),
});
export type PermissaoGrupo = z.infer<typeof permissoesSchema>;

// ============================================================================
// SCHEMAS E TYPES: LOGS (AUDITORIA GERAL DO SISTEMA)
// ============================================================================

export const logAtividadeSchema = baseConfigSchema.extend({
  usuario_id: z.string().min(1, "ID do usuário é obrigatório"),
  usuario_nome: z.string().optional(),
  acao: z.string().min(1, "Ação é obrigatória (ex: CREATE, UPDATE, DELETE)"),
  modulo: z.string().min(1, "Módulo afetado é obrigatório"),
  registro_id: z.string().optional(), // Qual ID de documento foi alterado
  detalhes: z.string().optional(), // Payload JSON em string para diff
  ip: z.string().optional(),
});
export type LogAtividade = z.infer<typeof logAtividadeSchema>;
