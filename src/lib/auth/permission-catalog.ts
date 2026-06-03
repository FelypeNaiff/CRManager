export const PERMISSION_MODULES = [
  'DASHBOARD',
  'CRM',
  'CLIENTES',
  'FILHOS',
  'CARTEIRA',
  'PDV',
  'VENDAS',
  'CAIXA',
  'PRODUTOS',
  'ESTOQUE',
  'TROCAS',
  'DEVOLUCOES',
  'FINANCEIRO',
  'RELATORIOS',
  'CONFIGURACOES',
  'CONFIGURACOES_EMPRESA',
  'CONFIGURACOES_OPERACIONAIS',
  'USUARIOS',
  'GRUPOS_USUARIOS',
  'PERMISSOES',
  'LOGS'
] as const;

export const PERMISSION_ACTIONS = [
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'CANCEL',
  'CANCEL_SALE',
  'AUTHORIZE',
  'EXPORT',
  'IMPORT',
  'ADJUST',
  'OPEN',
  'CLOSE',
  'CASH_SUPPLY',
  'CASH_WITHDRAWAL',
  'AUTHORIZE_MOVEMENT',
  'CREATE_SALE',
  'APPLY_DISCOUNT',
  'AUTHORIZE_DISCOUNT',
  'AUTHORIZE_CANCEL',
  'AUTHORIZE_ADJUST',
  'CREDIT',
  'DEBIT',
  'DISABLE',
  'RESET_PIN'
] as const;

export type PermissionModule = typeof PERMISSION_MODULES[number];
export type PermissionAction = typeof PERMISSION_ACTIONS[number];

export interface PermissionDefinition {
  module: PermissionModule;
  action: PermissionAction;
  label: string;
  description: string;
  category: string;
  critical: boolean;
  routePatterns?: string[];
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // DASHBOARD
  { module: 'DASHBOARD', action: 'VIEW', label: 'Visualizar Dashboard', description: 'Acessar a tela inicial e métricas gerais.', category: 'Geral', critical: false, routePatterns: ['^/$', '^/dashboard'] },

  // CRM
  { module: 'CRM', action: 'VIEW', label: 'Visualizar CRM', description: 'Acessar o painel principal de CRM.', category: 'Comercial', critical: false, routePatterns: ['^/crm.*'] },

  // CLIENTES
  { module: 'CLIENTES', action: 'VIEW', label: 'Listar Clientes', description: 'Visualizar listagem de clientes.', category: 'Comercial', critical: false, routePatterns: ['^/clientes', '^/crm/clientes'] },
  { module: 'CLIENTES', action: 'CREATE', label: 'Criar Clientes', description: 'Cadastrar novos clientes no sistema.', category: 'Comercial', critical: false },
  { module: 'CLIENTES', action: 'UPDATE', label: 'Editar Clientes', description: 'Modificar dados de clientes existentes.', category: 'Comercial', critical: false },
  { module: 'CLIENTES', action: 'DELETE', label: 'Excluir Clientes', description: 'Remover clientes do sistema.', category: 'Comercial', critical: true },
  { module: 'CLIENTES', action: 'EXPORT', label: 'Exportar Clientes', description: 'Exportar lista de clientes para planilha.', category: 'Comercial', critical: false },
  { module: 'CLIENTES', action: 'IMPORT', label: 'Importar Clientes', description: 'Importar clientes via planilha.', category: 'Comercial', critical: false },

  // FILHOS
  { module: 'FILHOS', action: 'VIEW', label: 'Visualizar Filhos', description: 'Visualizar listagem de dependentes.', category: 'Comercial', critical: false, routePatterns: ['^/filhos', '^/crm/filhos'] },
  { module: 'FILHOS', action: 'CREATE', label: 'Cadastrar Filhos', description: 'Vincular e criar dependentes para os clientes.', category: 'Comercial', critical: false },
  { module: 'FILHOS', action: 'UPDATE', label: 'Editar Filhos', description: 'Modificar dados de dependentes.', category: 'Comercial', critical: false },
  { module: 'FILHOS', action: 'DELETE', label: 'Excluir Filhos', description: 'Remover dependentes.', category: 'Comercial', critical: true },

  // CARTEIRA
  { module: 'CARTEIRA', action: 'VIEW', label: 'Visualizar Carteira', description: 'Consultar saldos na carteira do cliente.', category: 'Financeiro', critical: false, routePatterns: ['^/wallet', '^/crm/carteira'] },
  { module: 'CARTEIRA', action: 'CREDIT', label: 'Crédito Manual', description: 'Adicionar saldo manualmente à carteira.', category: 'Financeiro', critical: true },
  { module: 'CARTEIRA', action: 'DEBIT', label: 'Débito Manual', description: 'Descontar saldo manualmente.', category: 'Financeiro', critical: true },
  { module: 'CARTEIRA', action: 'ADJUST', label: 'Ajuste de Saldo', description: 'Acertos contábeis de saldo.', category: 'Financeiro', critical: true },
  { module: 'CARTEIRA', action: 'AUTHORIZE', label: 'Autorizar Operações', description: 'Autorizar modificações na carteira.', category: 'Financeiro', critical: true },

  // PDV
  { module: 'PDV', action: 'VIEW', label: 'Acessar PDV', description: 'Abrir a tela de PDV principal.', category: 'Vendas', critical: false, routePatterns: ['^/pdv'] },
  { module: 'PDV', action: 'CREATE', label: 'Criar no PDV', description: 'Ação base para inicializar carrinhos no PDV.', category: 'Vendas', critical: false },
  { module: 'PDV', action: 'CREATE_SALE', label: 'Finalizar Venda (PDV)', description: 'Registrar novas vendas.', category: 'Vendas', critical: false },
  { module: 'PDV', action: 'APPLY_DISCOUNT', label: 'Aplicar Desconto', description: 'Conceder desconto no momento da venda (sujeito ao limite de percentual).', category: 'Vendas', critical: false },
  { module: 'PDV', action: 'AUTHORIZE_DISCOUNT', label: 'Autorizar Desconto', description: 'Permite autorizar descontos além do limite do vendedor.', category: 'Vendas', critical: true },
  { module: 'PDV', action: 'CANCEL_SALE', label: 'Cancelar Venda no PDV', description: 'Cancelar uma venda diretamente na tela do PDV.', category: 'Vendas', critical: true },

  // VENDAS
  { module: 'VENDAS', action: 'VIEW', label: 'Visualizar Vendas', description: 'Ver o histórico de vendas realizadas.', category: 'Vendas', critical: false, routePatterns: ['^/sales', '^/comercial/vendas'] },
  { module: 'VENDAS', action: 'CREATE', label: 'Lançar Venda', description: 'Registrar venda fora do PDV.', category: 'Vendas', critical: false },
  { module: 'VENDAS', action: 'UPDATE', label: 'Editar Venda', description: 'Alterar observações ou dados da venda.', category: 'Vendas', critical: false },
  { module: 'VENDAS', action: 'CANCEL', label: 'Cancelar Venda (Geral)', description: 'Cancelar venda pelo painel administrativo.', category: 'Vendas', critical: true },
  { module: 'VENDAS', action: 'AUTHORIZE_CANCEL', label: 'Autorizar Cancelamento', description: 'Permite autorizar cancelamentos bloqueados.', category: 'Vendas', critical: true },
  { module: 'VENDAS', action: 'EXPORT', label: 'Exportar Vendas', description: 'Exportar relatórios de vendas.', category: 'Vendas', critical: false },

  // CAIXA
  { module: 'CAIXA', action: 'VIEW', label: 'Visualizar Caixa', description: 'Acessar a listagem de caixas do turno.', category: 'Financeiro', critical: false, routePatterns: ['^/financeiro/caixas'] },
  { module: 'CAIXA', action: 'OPEN', label: 'Abrir Caixa', description: 'Iniciar o turno de um caixa.', category: 'Financeiro', critical: false },
  { module: 'CAIXA', action: 'CLOSE', label: 'Fechar Caixa', description: 'Encerrar o turno de um caixa.', category: 'Financeiro', critical: false },
  { module: 'CAIXA', action: 'CASH_SUPPLY', label: 'Reforço de Caixa', description: 'Entrada de troco/suprimento no gaveteiro.', category: 'Financeiro', critical: false },
  { module: 'CAIXA', action: 'CASH_WITHDRAWAL', label: 'Sangria', description: 'Retirada de dinheiro do caixa.', category: 'Financeiro', critical: true },
  { module: 'CAIXA', action: 'AUTHORIZE_MOVEMENT', label: 'Autorizar Movimentação', description: 'Aprovar sangrias ou suprimentos.', category: 'Financeiro', critical: true },

  // PRODUTOS
  { module: 'PRODUTOS', action: 'VIEW', label: 'Listar Produtos', description: 'Ver o catálogo de produtos.', category: 'Estoque', critical: false, routePatterns: ['^/produtos', '^/products'] },
  { module: 'PRODUTOS', action: 'CREATE', label: 'Cadastrar Produtos', description: 'Adicionar novos itens ao catálogo.', category: 'Estoque', critical: false },
  { module: 'PRODUTOS', action: 'UPDATE', label: 'Editar Produtos', description: 'Modificar preços, nomes e atributos.', category: 'Estoque', critical: false },
  { module: 'PRODUTOS', action: 'DELETE', label: 'Excluir Produtos', description: 'Remover produtos do sistema.', category: 'Estoque', critical: true },
  { module: 'PRODUTOS', action: 'IMPORT', label: 'Importar Produtos', description: 'Subir lote via planilha.', category: 'Estoque', critical: false },
  { module: 'PRODUTOS', action: 'EXPORT', label: 'Exportar Produtos', description: 'Baixar lista em planilha.', category: 'Estoque', critical: false },

  // ESTOQUE
  { module: 'ESTOQUE', action: 'VIEW', label: 'Visualizar Estoque', description: 'Acompanhar quantidades, variações e saldos.', category: 'Estoque', critical: false, routePatterns: ['^/estoque', '^/movimentacoes'] },
  { module: 'ESTOQUE', action: 'ADJUST', label: 'Ajuste Manual', description: 'Realizar entrada ou saída forçada.', category: 'Estoque', critical: true },
  { module: 'ESTOQUE', action: 'IMPORT', label: 'Importar Estoque', description: 'Carga inicial via planilha.', category: 'Estoque', critical: false },
  { module: 'ESTOQUE', action: 'EXPORT', label: 'Exportar Estoque', description: 'Relatório de quantidades.', category: 'Estoque', critical: false },
  { module: 'ESTOQUE', action: 'AUTHORIZE_ADJUST', label: 'Autorizar Ajustes', description: 'Aprovar edições de estoque.', category: 'Estoque', critical: true },

  // TROCAS
  { module: 'TROCAS', action: 'VIEW', label: 'Listar Trocas', description: 'Ver histórico de trocas.', category: 'Comercial', critical: false, routePatterns: ['^/comercial/trocas', '^/crm/trocas'] },
  { module: 'TROCAS', action: 'CREATE', label: 'Lançar Troca', description: 'Operacionalizar uma troca.', category: 'Comercial', critical: false },
  { module: 'TROCAS', action: 'CANCEL', label: 'Cancelar Troca', description: 'Estornar uma troca feita incorretamente.', category: 'Comercial', critical: true },
  { module: 'TROCAS', action: 'AUTHORIZE', label: 'Autorizar Troca', description: 'Liberar bloqueios gerenciais de troca.', category: 'Comercial', critical: true },

  // DEVOLUCOES
  { module: 'DEVOLUCOES', action: 'VIEW', label: 'Listar Devoluções', description: 'Visualizar registros de devolução.', category: 'Comercial', critical: false, routePatterns: ['^/returns', '^/vendas/devolucoes'] },
  { module: 'DEVOLUCOES', action: 'CREATE', label: 'Processar Devolução', description: 'Receber produtos e devolver dinheiro/crédito.', category: 'Comercial', critical: true },
  { module: 'DEVOLUCOES', action: 'CANCEL', label: 'Estornar Devolução', description: 'Reverter o processo de devolução.', category: 'Comercial', critical: true },
  { module: 'DEVOLUCOES', action: 'AUTHORIZE', label: 'Autorizar Devolução', description: 'Permissão para liberar devoluções.', category: 'Comercial', critical: true },

  // FINANCEIRO
  { module: 'FINANCEIRO', action: 'VIEW', label: 'Visualizar Financeiro', description: 'Acessar painéis de fluxo de caixa, DRE e contas.', category: 'Financeiro', critical: false, routePatterns: ['^/financeiro.*'] },
  { module: 'FINANCEIRO', action: 'CREATE', label: 'Lançar Títulos', description: 'Criar contas a pagar/receber.', category: 'Financeiro', critical: false },
  { module: 'FINANCEIRO', action: 'UPDATE', label: 'Editar Títulos', description: 'Modificar lançamentos.', category: 'Financeiro', critical: false },
  { module: 'FINANCEIRO', action: 'DELETE', label: 'Excluir Títulos', description: 'Remover histórico financeiro.', category: 'Financeiro', critical: true },
  { module: 'FINANCEIRO', action: 'CANCEL', label: 'Cancelar Títulos', description: 'Inativar sem excluir.', category: 'Financeiro', critical: true },
  { module: 'FINANCEIRO', action: 'EXPORT', label: 'Exportar Relatórios', description: 'Baixar dados financeiros.', category: 'Financeiro', critical: false },

  // RELATORIOS
  { module: 'RELATORIOS', action: 'VIEW', label: 'Acessar Relatórios', description: 'Consultar dashboards e listagens gerenciais.', category: 'Geral', critical: false, routePatterns: ['^/relatorios', '^/comercial/relatorios'] },
  { module: 'RELATORIOS', action: 'EXPORT', label: 'Exportar Relatórios', description: 'Salvar documentos e relatórios.', category: 'Geral', critical: false },

  // CONFIGURACOES
  { module: 'CONFIGURACOES', action: 'VIEW', label: 'Painel de Configurações', description: 'Acessar área administrativa.', category: 'Configurações', critical: true, routePatterns: ['^/configuracoes$', '^/settings', '^/setup'] },

  // CONFIGURACOES_EMPRESA
  { module: 'CONFIGURACOES_EMPRESA', action: 'VIEW', label: 'Visualizar Dados Empresariais', description: 'Consultar os parâmetros da empresa.', category: 'Configurações', critical: false, routePatterns: ['^/configuracoes/empresa', '^/configuracoes/dados-empresa', '^/configuracoes/minha-empresa'] },
  { module: 'CONFIGURACOES_EMPRESA', action: 'UPDATE', label: 'Alterar Dados Empresariais', description: 'Modificar CNPJ, contatos, impostos e fiscais.', category: 'Configurações', critical: true },

  // CONFIGURACOES_OPERACIONAIS
  { module: 'CONFIGURACOES_OPERACIONAIS', action: 'VIEW', label: 'Visualizar Parâmetros', description: 'Ver regras do PDV e sistema.', category: 'Configurações', critical: false, routePatterns: ['^/configuracoes/configuracoes-operacionais'] },
  { module: 'CONFIGURACOES_OPERACIONAIS', action: 'UPDATE', label: 'Alterar Parâmetros', description: 'Ligar/desligar exigências vitais (ex: Estoque negativo).', category: 'Configurações', critical: true },

  // USUARIOS
  { module: 'USUARIOS', action: 'VIEW', label: 'Listar Usuários', description: 'Visualizar equipe.', category: 'Segurança', critical: false, routePatterns: ['^/configuracoes/usuarios', '^/usuarios'] },
  { module: 'USUARIOS', action: 'CREATE', label: 'Criar Usuários', description: 'Registrar novos membros na equipe.', category: 'Segurança', critical: true },
  { module: 'USUARIOS', action: 'UPDATE', label: 'Editar Usuários', description: 'Alterar nomes, emails e e-mails.', category: 'Segurança', critical: true },
  { module: 'USUARIOS', action: 'DISABLE', label: 'Desativar Usuários', description: 'Bloquear acesso do funcionário.', category: 'Segurança', critical: true },
  { module: 'USUARIOS', action: 'RESET_PIN', label: 'Resetar PIN', description: 'Gerar uma nova senha operacional forçada.', category: 'Segurança', critical: true },

  // GRUPOS_USUARIOS
  { module: 'GRUPOS_USUARIOS', action: 'VIEW', label: 'Visualizar Perfis', description: 'Acessar grupos e roles.', category: 'Segurança', critical: false, routePatterns: ['^/configuracoes/grupos-usuarios', '^/configuracoes/perfis'] },
  { module: 'GRUPOS_USUARIOS', action: 'CREATE', label: 'Criar Perfis', description: 'Criar novas hierarquias.', category: 'Segurança', critical: true },
  { module: 'GRUPOS_USUARIOS', action: 'UPDATE', label: 'Editar Perfis', description: 'Ajustar comissões/limites.', category: 'Segurança', critical: true },
  { module: 'GRUPOS_USUARIOS', action: 'DELETE', label: 'Excluir Perfis', description: 'Deletar grupos vazios.', category: 'Segurança', critical: true },

  // PERMISSOES
  { module: 'PERMISSOES', action: 'VIEW', label: 'Visualizar Matriz', description: 'Checar quem pode fazer o que.', category: 'Segurança', critical: true, routePatterns: ['^/configuracoes/permissoes', '^/configuracoes/grupos-usuarios/.*?/permissoes'] },
  { module: 'PERMISSOES', action: 'UPDATE', label: 'Alterar Privilégios', description: 'Conceder/Revogar permissões da matriz.', category: 'Segurança', critical: true },

  // LOGS
  { module: 'LOGS', action: 'VIEW', label: 'Visualizar Auditoria', description: 'Ver logs de segurança.', category: 'Segurança', critical: true, routePatterns: ['^/configuracoes/logs'] },
  { module: 'LOGS', action: 'EXPORT', label: 'Exportar Logs', description: 'Baixar relatório de auditoria.', category: 'Segurança', critical: false },
];

export const TEMPLATES: Record<string, { module: PermissionModule, action: PermissionAction }[]> = {
  VENDEDOR: [
    { module: 'DASHBOARD', action: 'VIEW' },
    { module: 'CLIENTES', action: 'VIEW' },
    { module: 'CLIENTES', action: 'CREATE' },
    { module: 'FILHOS', action: 'VIEW' },
    { module: 'FILHOS', action: 'CREATE' },
    { module: 'PDV', action: 'VIEW' },
    { module: 'PDV', action: 'CREATE' },
    { module: 'PDV', action: 'CREATE_SALE' },
    { module: 'PDV', action: 'APPLY_DISCOUNT' },
    { module: 'PRODUTOS', action: 'VIEW' },
    { module: 'VENDAS', action: 'VIEW' },
    { module: 'VENDAS', action: 'CREATE' },
  ],
  CAIXA: [
    { module: 'DASHBOARD', action: 'VIEW' },
    { module: 'PDV', action: 'VIEW' },
    { module: 'PDV', action: 'CREATE' },
    { module: 'PDV', action: 'CREATE_SALE' },
    { module: 'PDV', action: 'APPLY_DISCOUNT' },
    { module: 'CAIXA', action: 'VIEW' },
    { module: 'CAIXA', action: 'OPEN' },
    { module: 'CAIXA', action: 'CLOSE' },
    { module: 'CAIXA', action: 'CASH_SUPPLY' },
    { module: 'VENDAS', action: 'VIEW' },
  ],
  GERENTE: [
    // Include all VENDEDOR/CAIXA permissions
    { module: 'DASHBOARD', action: 'VIEW' },
    { module: 'CLIENTES', action: 'VIEW' },
    { module: 'CLIENTES', action: 'CREATE' },
    { module: 'CLIENTES', action: 'UPDATE' },
    { module: 'FILHOS', action: 'VIEW' },
    { module: 'FILHOS', action: 'CREATE' },
    { module: 'FILHOS', action: 'UPDATE' },
    { module: 'PDV', action: 'VIEW' },
    { module: 'PDV', action: 'CREATE' },
    { module: 'PDV', action: 'CREATE_SALE' },
    { module: 'PDV', action: 'APPLY_DISCOUNT' },
    { module: 'PRODUTOS', action: 'VIEW' },
    { module: 'VENDAS', action: 'VIEW' },
    { module: 'VENDAS', action: 'CREATE' },
    { module: 'CAIXA', action: 'VIEW' },
    { module: 'CAIXA', action: 'OPEN' },
    { module: 'CAIXA', action: 'CLOSE' },
    { module: 'CAIXA', action: 'CASH_SUPPLY' },
    
    // Additional GERENTE permissions
    { module: 'PDV', action: 'AUTHORIZE_DISCOUNT' },
    { module: 'VENDAS', action: 'CANCEL' },
    { module: 'VENDAS', action: 'AUTHORIZE_CANCEL' },
    { module: 'CAIXA', action: 'CASH_WITHDRAWAL' },
    { module: 'TROCAS', action: 'VIEW' },
    { module: 'TROCAS', action: 'CREATE' },
    { module: 'TROCAS', action: 'AUTHORIZE' },
    { module: 'DEVOLUCOES', action: 'VIEW' },
    { module: 'DEVOLUCOES', action: 'CREATE' },
    { module: 'DEVOLUCOES', action: 'AUTHORIZE' },
    { module: 'CARTEIRA', action: 'VIEW' },
    { module: 'CARTEIRA', action: 'ADJUST' },
    { module: 'RELATORIOS', action: 'VIEW' },
    { module: 'RELATORIOS', action: 'EXPORT' },
    { module: 'ESTOQUE', action: 'VIEW' },
  ],
  CONSULTA: [
    { module: 'DASHBOARD', action: 'VIEW' },
    { module: 'CLIENTES', action: 'VIEW' },
    { module: 'FILHOS', action: 'VIEW' },
    { module: 'PRODUTOS', action: 'VIEW' },
    { module: 'VENDAS', action: 'VIEW' },
    { module: 'ESTOQUE', action: 'VIEW' },
    { module: 'RELATORIOS', action: 'VIEW' },
  ]
};

export const ADMIN_TEMPLATE = PERMISSION_CATALOG.map(p => ({
  module: p.module,
  action: p.action
}));
