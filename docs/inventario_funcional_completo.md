# Inventário Funcional Completo — CRM TRUPE / NEEX

Este inventário tem como objetivo mapear 100% das funcionalidades, rotas, telas, ações, regras de negócio e dependências (Firebase Auth, Firestore, localStorage) do sistema **CRM TRUPE / NEEX** antes de iniciar a migração de dados e regras de negócio operacionais para o Supabase PostgreSQL.

---

## 🗺️ Visão Geral da Arquitetura de Dados Operacionais (Firebase NoSQL)

Abaixo está o mapeamento das coleções ativas no Firebase Firestore que sustentam o sistema atual:

1. **`clientes`**: Cadastro principal de clientes (mães/pais, contatos, aniversários).
2. **`filhos`**: Vinculado a `clientes`. Cadastro de crianças para controle de idade, aniversário e preferências.
3. **`carteiras_clientes`**: Saldo acumulado (crédito/débito) de cada cliente para compras/trocas.
4. **`movimentacoes_saldo`**: Histórico detalhado de depósitos e saques da carteira do cliente.
5. **`trocas_devolucoes`**: Registros de devoluções de mercadorias e concessão de vales/créditos.
6. **`tags`**: Tags para segmentação de clientes no CRM (ex: "VIP", "Inativo").
7. **`clientes_tags`**: Tabela de junção que vincula clientes a tags.
8. **`historico_cliente`**: Linha do tempo de atendimentos e interações com o cliente.
9. **`atendimentos`**: Registros individuais de atendimentos no CRM.
10. **`produtos`**: Cadastro de itens com variações, código interno, valor de compra/venda.
    - *Subcoleção:* `historico_precos`: Registro de mudanças de preço por item.
11. **`gruposProdutos`**: Categorias/famílias de produtos (ex: "Calçados", "Acessórios").
12. **`fornecedores`**: Cadastro de fabricantes e distribuidores.
13. **`movimentacoes_estoque`**: Histórico de entradas, saídas e ajustes manuais de estoque.
14. **`vendas`**: Pedidos e vendas efetuados no PDV ou módulo de vendas.
15. **`accounts_receivable`**: Contas a receber geradas pelo financeiro ou pelas vendas parceladas.
16. **`accounts_payable`**: Contas a pagar geradas pelo módulo financeiro (compras, despesas).
17. **`financial_transactions`**: Transações e lançamentos de caixa/banco realizados.
18. **`bank_accounts`**: Contas bancárias e caixas físicos ativos na empresa.
19. **`chart_of_accounts`**: Plano de contas para categorização financeira.
20. **`payment_methods`**: Formas de pagamento aceitas no PDV e financeiro.
21. **`vales_funcionarios`**: Adiantamentos e vales de colaboradores.
22. **`logs_atividades`**: Auditoria interna de ações operacionais dos perfis.

---

## 📦 Inventário Detalhado por Módulo

### 1. Dashboard (Geral)
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/dashboard` (ou `/`)
*   **Componentes Usados:** Indicadores rápidos (`KPI Cards`), gráficos de venda diária e mensal, listagem de atividades recentes.
*   **Coleções Firebase:** `vendas`, `logs_atividades`, `clientes`.
*   **Campos Utilizados:**
    *   Leitura: `vendas.valorTotal`, `vendas.dataVenda`, `clientes.created_at`, `logs_atividades.detalhes`.
*   **Ações Disponíveis:** Filtragem por período (Hoje, 7 dias, 30 dias).
*   **Permissões Necessárias:** Nenhuma (Acesso livre para perfis ativos).
*   **Sugestão de Tabela Supabase:** Consultas agregadas sobre `sales`, `clients` e `activity_logs`.

---

### 2. Clientes (CRM)
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/crm/clientes`
*   **Componentes Usados:** Tabela de listagem, Filtros avançados, Modal de cadastro/edição, Modal de histórico.
*   **Coleções Firebase:** `clientes`, `filhos`, `carteiras_clientes`, `clientes_tags`, `tags`.
*   **Campos Utilizados:**
    *   Gravação/Leitura: `nome`, `email`, `telefone`, `cpf`, `data_nascimento`, `instagram`, `observacoes`, `status`.
*   **Ações Disponíveis:** Novo cadastro, Editar, Excluir (Soft delete), Visualizar Histórico, Vincular Tags, Visualizar Filhos vinculados.
*   **Permissões Necessárias:** `Clientes:visualizar`, `Clientes:criar`, `Clientes:editar`, `Clientes:excluir`.
*   **Riscos de Migração:** Integridade referencial com filhos, tags e saldo de carteira.
*   **Sugestão de Tabela Supabase:** `clients` (UUID, tenant_id, name, email, phone, cpf, birth_day, birth_month, birth_year, status).

---

### 3. Filhos (CRM)
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/crm/filhos` (Acessível também por dentro da ficha do cliente).
*   **Componentes Usados:** Listagem de crianças, formulário de cadastro rápido.
*   **Coleções Firebase:** `filhos`, `clientes`.
*   **Campos Utilizados:**
    *   Gravação/Leitura: `cliente_id`, `nome`, `data_nascimento`, `sexo`, `tamanho_calcado`, `tamanho_roupa`, `observacoes`.
*   **Ações Disponíveis:** Adicionar filho, Editar dados, Remover vínculo.
*   **Permissões Necessárias:** `Filhos:visualizar` ou `Clientes:visualizar`.
*   **Sugestão de Tabela Supabase:** `client_children` (UUID, client_id, name, birth_date, gender, shoe_size, clothing_size, notes).

---

### 4. Aniversariantes (CRM)
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/crm/clientes` (Filtro/Aba de Aniversariantes).
*   **Componentes Usados:** Tabela customizada com filtros por mês.
*   **Coleções Firebase:** `clientes`, `filhos`.
*   **Campos Utilizados:**
    *   Leitura: `clientes.data_nascimento`, `filhos.data_nascimento`, `clientes.nome`, `filhos.nome`.
*   **Ações Disponíveis:** Filtrar por mês de nascimento, enviar mensagem rápida via WhatsApp (template de parabéns).
*   **Permissões Necessárias:** `Clientes:visualizar`.
*   **Sugestão de Tabela Supabase:** Consultas SQL nativas usando `EXTRACT(MONTH FROM birth_date)`.

---

### 5. Campanhas WhatsApp (CRM)
*   **Status Atual:** Funcional (Disparo manual direcionado via URL API do WhatsApp).
*   **Rota:** `/crm/campanhas`
*   **Componentes Usados:** Editor de templates de mensagens, seletor de público-alvo (por tag ou filtros de compra).
*   **Coleções Firebase:** `clientes`, `tags`, `clientes_tags`.
*   **Campos Utilizados:**
    *   Leitura: `clientes.telefone`, `clientes.nome`, `tags.nome`.
*   **Ações Disponíveis:** Criar template, filtrar base de clientes, gerar link de envio (API WhatsApp Web com texto pré-definido).
*   **Permissões Necessárias:** `CRM:visualizar`.
*   **Sugestão de Tabela Supabase:** `crm_campaigns`, `crm_campaign_templates`.

---

### 6. Carteiras / Saldos (CRM)
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/crm/carteira`
*   **Componentes Usados:** Painel de créditos, extrato de movimentações, botões de ajuste de saldo.
*   **Coleções Firebase:** `carteiras_clientes`, `movimentacoes_saldo`.
*   **Campos Utilizados:**
    *   Gravação/Leitura: `cliente_id`, `saldo_atual`, `valor_movimentado`, `tipo_movimentacao` (credito/debito), `motivo`.
*   **Ações Disponíveis:** Lançar crédito manual, Lançar débito manual, Visualizar extrato detalhado do cliente.
*   **Permissões Necessárias:** `Financeiro:acessar`.
*   **Sugestão de Tabela Supabase:** `client_wallets` e `client_wallet_movements`.

---

### 7. Trocas e Devoluções
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/crm/trocas`
*   **Componentes Usados:** Tela de seleção de venda original, seletor de itens devolvidos, geração de saldo em carteira (crédito).
*   **Coleções Firebase:** `trocas_devolucoes`, `vendas`, `produtos`, `carteiras_clientes`, `movimentacoes_saldo`.
*   **Campos Utilizados:**
    *   Gravação/Leitura: `cliente_id`, `venda_id`, `itens_devolvidos` (array), `valor_total_credito`, `motivo_devolucao`.
*   **Ações Disponíveis:** Iniciar processo de troca/devolução, selecionar itens, gerar crédito automático na carteira do cliente, retornar produto ao estoque.
*   **Permissões Necessárias:** `Trocas:visualizar`.
*   **Sugestão de Tabela Supabase:** `returns_exchanges`, `return_items`.

---

### 8. Clientes com Saldo
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/crm/carteira` (Aba ou filtro específico de saldos credores).
*   **Componentes Usados:** Relatório tabular ordenado pelos maiores créditos de clientes.
*   **Coleções Firebase:** `carteiras_clientes`, `clientes`.
*   **Campos Utilizados:**
    *   Leitura: `clientes.nome`, `carteiras_clientes.saldo_atual`.
*   **Ações Disponíveis:** Exportar lista, auditar movimentações do cliente.
*   **Permissões Necessárias:** `Financeiro:acessar`.
*   **Sugestão de Tabela Supabase:** Query com `JOIN` entre `clients` e `client_wallets` filtrando `saldo_atual > 0`.

---

### 9. Produtos
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/produtos`, `/produtos/novo`, `/produtos/editar/[id]`, `/produtos/importar-planilha`
*   **Componentes Usados:** Listagem de produtos com paginação virtual, upload de fotos, importador CSV (xlsx), histórico de preços.
*   **Coleções Firebase:** `produtos`, `gruposProdutos`, `fornecedores`.
*   **Campos Utilizados:**
    *   Gravação/Leitura: `codigoInterno`, `nome`, `valorCusto`, `valorVenda`, `lucro`, `estoqueAtual`, `estoqueMinimo`, `grupo`, `marca`, `fornecedorId`.
*   **Ações Disponíveis:** Novo produto, Editar, Excluir, Reajuste de preços em lote, Upload de planilha de importação, Visualizar histórico de alterações de preços.
*   **Permissões Necessárias:** `Produtos:visualizar`, `Produtos:criar`, `Produtos:editar`, `Produtos:excluir`.
*   **Sugestão de Tabela Supabase:** `products`, `product_price_history`.

---

### 10. Estoque
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/movimentacoes` (Acessível também a partir de `/produtos`).
*   **Componentes Usados:** Modal de movimentação manual de estoque, tabela de histórico de movimentação.
*   **Coleções Firebase:** `movimentacoes_estoque`, `produtos`.
*   **Campos Utilizados:**
    *   Gravação: `produtoId`, `tipo` (Entrada/Saída), `qntMovim`, `qntFinal`, `custoUnit`, `descricao`, `dataHora`.
*   **Ações Disponíveis:** Entrada de estoque, Saída de estoque, Ajuste de inventário por perdas/roubos, Visualizar log detalhado.
*   **Permissões Necessárias:** `Estoque:visualizar`.
*   **Sugestão de Tabela Supabase:** `stock_movements`.

---

### 11. Vendas
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/vendas`
*   **Componentes Usados:** Tabela de listagem de vendas concluídas, filtros de status (Pendente, Faturada, Cancelada), visualizador de cupom/detalhes da venda.
*   **Coleções Firebase:** `vendas`, `clientes`.
*   **Campos Utilizados:**
    *   Leitura/Gravação: `clientId`, `itens` (array), `subtotal`, `desconto`, `valorTotal`, `formaPagamento`, `status`, `dataVenda`.
*   **Ações Disponíveis:** Visualizar detalhes da venda, Imprimir cupom térmico não-fiscal, Cancelar venda (com estorno de estoque e financeiro).
*   **Permissões Necessárias:** `Vendas:visualizar`.
*   **Sugestão de Tabela Supabase:** `sales_orders`, `sales_order_items`.

---

### 12. PDV (Frente de Caixa)
*   **Status Atual:** 100% Funcional (Crítico).
*   **Rota:** `/pdv`
*   **Componentes Usados:** Interface simplificada de alta velocidade de digitação, seletor de produtos rápido, busca por código de barras, modal de pagamento multifórmulas.
*   **Coleções Firebase:** `vendas`, `produtos`, `clientes`, `carteiras_clientes`, `movimentacoes_saldo`, `accounts_receivable`, `financial_transactions`.
*   **Campos Utilizados:**
    *   Leitura/Gravação: Todos os campos de vendas e transações financeiras.
*   **Ações Disponíveis:** Adicionar produto ao carrinho, aplicar desconto em R$ ou %, cadastrar cliente na hora, selecionar operador de caixa, fechar venda com formas de pagamento mescladas, utilizar crédito de carteira do cliente como forma de pagamento.
*   **Permissões Necessárias:** `PDV:visualizar`.
*   **Sugestão de Tabela Supabase:** Transação coordenada utilizando `sales_orders`, `client_wallets`, e `financial_ledger`.

---

### 13. Financeiro
*   **Status Atual:** 100% Funcional.
*   **Rota:** `/financeiro`, `/financeiro/contas-a-pagar`, `/financeiro/contas-a-receber`, `/financeiro/fluxo-caixa`, `/financeiro/caixas`, `/financeiro/contas-bancarias`
*   **Componentes Usados:** Gráficos DRE, Conciliação bancária, Fluxo de caixa previsto x realizado, Calendário financeiro de vencimentos.
*   **Coleções Firebase:** `accounts_receivable`, `accounts_payable`, `financial_transactions`, `bank_accounts`, `chart_of_accounts`.
*   **Campos Utilizados:**
    *   Gravação/Leitura: `descricao`, `valor`, `vencimento`, `data_pagamento`, `categoria_plano_contas`, `conta_bancaria_id`, `status` (pago/pendente).
*   **Ações Disponíveis:** Lançar conta a pagar/receber, dar baixa em contas, transferir saldo entre contas bancárias, visualizar DRE simplificado.
*   **Permissões Necessárias:** `Financeiro:acessar`.
*   **Sugestão de Tabela Supabase:** `accounts_receivable`, `accounts_payable`, `financial_transactions`, `bank_accounts`, `chart_of_accounts`.

---

### 14. Configurações
*   **Status Atual:** 100% Funcional (Migrado para PostgreSQL no escopo de Auth/RBAC).
*   **Rota:** `/configuracoes`
*   **Componentes Usados:** Telas de parametrização da empresa, configurações do PDV, regras de tributação simplificada.
*   **Coleções Firebase:** Anteriormente `empresas` e `configuracoes_gerais`.
*   **Tabelas Supabase (Fase 1/2):** `companies`.
*   **Ações Disponíveis:** Editar dados da empresa, alterar dados do certificado digital (nfe).
*   **Permissões Necessárias:** `Configurações gerais:visualizar`.

---

### 15. Relatórios
*   **Status Atual:** Parcialmente simulado / Tabelas estáticas com dados mockados em alguns submenus.
*   **Rota:** `/relatorios`
*   **Componentes Usados:** Tabelas de exportação de dados estruturados.
*   **Coleções Firebase:** `vendas`, `produtos`, `clientes`.
*   **Ações Disponíveis:** Visualizar relatórios de vendas por período, produtos mais vendidos, margem de lucro real.
*   **Permissões Necessárias:** `Relatórios:visualizar`.
*   **Sugestão de Tabela Supabase:** Views SQL otimizadas para agregação de relatórios.

---

### 16. Usuários & Perfis & Permissões (Auth / RBAC)
*   **Status Atual:** 100% Migrado para PostgreSQL + Prisma (Pronto).
*   **Rota:** `/configuracoes/usuarios`, `/configuracoes/grupos-usuarios`
*   **Componentes Usados:** Lista de usuários cadastrados, painel de edição de PIN, matriz de permissões por grupo de acessos.
*   **Tabelas Supabase (Migradas):** `users`, `roles`, `permissions`.
*   **Ações Disponíveis:** Novo usuário interno, definir PIN seguro com bcrypt, ativar/inativar acesso, configurar grupo de acessos, definir matriz de permissões por grupo.
*   **Permissões Necessárias:** `Usuários:visualizar`, `Permissões:visualizar`.

---

### 17. Logs de Atividades (Auditoria)
*   **Status Atual:** 100% Migrado para PostgreSQL (Fase 2).
*   **Rota:** `/configuracoes/logs`
*   **Componentes Usados:** Visualizador tabular de logs do sistema.
*   **Tabelas Supabase (Migradas):** `activity_logs`.
*   **Ações Disponíveis:** Filtrar histórico de ações por usuário, data, ação (CREATE, UPDATE, DELETE, LOGIN, ACESSO_NEGADO).
*   **Permissões Necessárias:** `Logs:visualizar`.

---

## 🔒 Dependências Críticas

### 1. Dependências do Firebase Auth
*   **Login Google:** A entrada inicial do usuário no sistema depende do Firebase Auth (`signInWithPopup`).
*   **Autenticação unificada:** Atualmente, a sessão do Firebase Auth é necessária para carregar os perfis disponíveis no Supabase.

### 2. Dependências do Firestore (Coleções a migrar)
*   Todos os módulos operacionais (`clientes`, `produtos`, `vendas`, `financeiro`, `estoque`) realizam queries e mutations diretamente no Firestore através dos hooks `useCollection` e `useFirestore`.

### 3. Dependências de localStorage
*   `@crmanager:activeProfile`: Armazena os dados do perfil selecionado localmente no navegador (sincronizado na Fase 2 com o cookie de sessão seguro HTTP-only `@crmanager:activeProfileSession`).

### 4. Regras de Negócio Críticas (Não podem quebrar)
*   **Validação de Estoque no PDV:** O PDV não pode permitir a venda de itens sem estoque caso o parâmetro "bloquear_venda_sem_estoque" esteja ativo.
*   **Uso de Crédito na Venda:** Se o cliente possui saldo na carteira (`carteiras_clientes`), esse saldo pode ser consumido no fechamento da venda. A atualização do saldo e da venda deve ocorrer em uma única transação atômica.
*   **Devolução Geradora de Crédito:** O valor de um item devolvido deve ser obrigatoriamente estornado como saldo na carteira do cliente, registrando a transação no extrato financeiro.

---

## 📋 Checklist de Migração Funcional

| Módulo | Funcionalidade | Existe hoje? | Está funcional? | Banco atual | Tabela futura Supabase | Prioridade | Risco | Observações |
|---|---|---|---|---|---|---|---|---|
| **Auth/RBAC** | Login Google unificado | Sim | Sim | Firebase Auth | Supabase Auth (futuro) | Alta | Baixo | Integrado híbrido na Fase 2. |
| **Auth/RBAC** | Seleção de Perfil e PIN | Sim | Sim | PostgreSQL | `users` | Alta | Baixo | Migrado com bcrypt no servidor. |
| **Auth/RBAC** | Proteção de Rotas | Sim | Sim | PostgreSQL | `permissions` | Alta | Baixo | Implementado via Next.js Middleware. |
| **CRM** | Cadastro de Clientes | Sim | Sim | Firestore | `clients` | Alta | Médio | Requer manter UUIDs ou IDs sequenciais. |
| **CRM** | Cadastro de Filhos | Sim | Sim | Firestore | `client_children` | Média | Médio | Chave estrangeira para `clients`. |
| **CRM** | Carteira de Crédito | Sim | Sim | Firestore | `client_wallets` | Alta | Alto | Crítico para transações financeiras. |
| **CRM** | Extrato da Carteira | Sim | Sim | Firestore | `client_wallet_movements` | Alta | Alto | Histórico de créditos/débitos do cliente. |
| **CRM** | Histórico/Atendimentos | Sim | Sim | Firestore | `customer_interactions` | Baixa | Baixo | Registro histórico de interações. |
| **Produtos** | Cadastro de Itens | Sim | Sim | Firestore | `products` | Alta | Médio | Inclui variações e controle de grade. |
| **Produtos** | Histórico de Preços | Sim | Sim | Firestore | `product_price_history` | Média | Baixo | Triggers automáticos ao mudar preço. |
| **Produtos** | Grupos/Categorias | Sim | Sim | Firestore | `product_categories` | Média | Baixo | Simples mapeamento chave-valor. |
| **Produtos** | Fornecedores | Sim | Sim | Firestore | `suppliers` | Média | Baixo | Cadastro operacional simples. |
| **Estoque** | Lançamentos / Ajustes | Sim | Sim | Firestore | `stock_movements` | Alta | Alto | Deve atualizar o saldo em `products`. |
| **PDV** | Frente de Caixa | Sim | Sim | Firestore | `sales_orders` + `transactions` | Alta | Crítico | Sistema nervoso de vendas do comércio. |
| **Vendas** | Histórico / Cupom | Sim | Sim | Firestore | `sales_orders` | Alta | Médio | Consulta e reimpressão de vendas. |
| **Vendas** | Trocas / Devoluções | Sim | Sim | Firestore | `returns_exchanges` | Alta | Alto | Estorno de itens e geração de crédito. |
| **Financeiro** | Contas a Pagar/Receber | Sim | Sim | Firestore | `accounts_receivable`/`payable` | Alta | Alto | Integração direta com PDV e Compras. |
| **Financeiro** | Transações de Caixa | Sim | Sim | Firestore | `financial_ledger` | Alta | Alto | Lançamento e conciliação bancária. |
| **Financeiro** | Relatório DRE | Sim | Parcial | Firestore | views SQL customizadas | Média | Médio | Hoje em DRE simplificado. |
| **Config** | Dados da Empresa | Sim | Sim | Firestore | `companies` | Média | Baixo | Migrado na Fase 1/2. |
| **Logs** | Logs de Auditoria | Sim | Sim | PostgreSQL | `activity_logs` | Média | Baixo | Migrado na Fase 2. |
