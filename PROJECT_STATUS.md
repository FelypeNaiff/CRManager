# Diagnóstico e Status do Projeto CRManager (Trupe Kids)

**Data da Análise:** Outubro de 2026
**Stack Tecnológico:** Next.js (App Router), React, Tailwind CSS, Prisma ORM, Supabase (PostgreSQL / Auth), Shadcn UI (Radix).

---

## 1. O que está pronto (Módulos e Estrutura)

O sistema possui uma fundação arquitetural extremamente robusta e detalhada, desenhada para multilocação (multi-tenant com `companyId`).

- **Banco de Dados (Prisma + PostgreSQL):**
  - Modelagem massiva e já estabelecida. Tabelas principais cobrem domínios de Empresa, Usuários, Perfis (Roles/Permissões), Clientes, Filhos, Carteira (CustomerWallet), Produtos, Variações (Grades), Controle de Estoque (Armazéns, Movimentações, Posições), Financeiro (Transações, Caixas, Contas Bancárias) e Vendas (PDV).
  - Controle de Auditoria (ActivityLogs) estruturado para registrar ações de usuários no sistema.

- **Autenticação e Sessão:**
  - Supabase Auth devidamente integrado utilizando `@supabase/ssr` (`createBrowserClient` e `createServerClient`).
  - O sistema possui o `ServerAuthContext` que encapsula a leitura de perfil do usuário, empresa e permissões, sendo utilizado no backend e nas Server Actions para garantir segurança em nível de locatário (Tenant).

- **Módulos do Dashboard (`src/app/(dashboard)`):**
  - **CRM:** Muito maduro. O módulo `crm/clientes` contém fluxos completos para listagem, filtros, detalhamento em abas (Filhos, Histórico, Carteira Digital, Tags e Aniversariantes). As Actions de manipulação (criação, edição, ajustes de saldo) já se comunicam ativamente com o PostgreSQL via Prisma.
  - **Comercial / Vendas:** A interface de vendas em `comercial/vendas` já busca dados dinâmicos utilizando Server Actions (`listSalesAction`), com filtros por vendedor e status, suportando estados de Rascunho (Draft), Paga e Cancelada.
  - **PDV (Frente de Caixa):** Implementação substancial (arquivo com mais de 43kb). Possui gestão de rascunhos, canais de venda (Produto/Balcão).
  - **Estoque & Produtos:** Estruturas complexas para produtos com variações. Suporte para tabelas de preço, histórico de preços, entrada por importação de planilha (`produtos/importar-planilha`), inventários, movimentações e transferências.
  - **Financeiro:** Módulos de caixas (Cash Registers), fluxo de caixa, contas a pagar e a receber. Leitura direta no banco confirmada.

---

## 2. O que está em andamento (Incompleto ou em Transição)

- **Transição Firebase ➔ Supabase:**
  - Há arquivos como `legacy-firestore-stubs.ts` e `legacy-auth-stubs.ts` que indicam que o sistema ainda carrega pontas soltas da sua versão antiga hospedada em Firebase (Firestore).
  - Algumas buscas por `legacyFirebaseId` nas tabelas Prisma revelam que houve ou haverá importação de dados legados e sincronização.

- **Segurança de Banco e Políticas (RLS):**
  - Embora a documentação mencione o "Row Level Security (RLS)", não foram encontradas migrações SQL nativas habilitando o RLS. O isolamento de clientes hoje baseia-se pesadamente no filtro de `companyId` gerido via Prisma (`ServerAuthContext`). 
  - Isso é viável, mas difere da infraestrutura pura do Supabase RLS.

---

## 3. Gargalos e Débitos Técnicos Encontrados

1. **Mocks Residuais em Fluxos Complexos:**
   - Em `comercial/vendas/[id]/page.tsx`, há anotações de "Modal Cancelamento (simples mock para fluxo)". Alguns modais de ação em profundidade ainda carecem de integração real.
   - Em `financial/receivables-service.ts`, há observações de pendências como "Cancelar todos os AccountsReceivable ainda não liquidados integralmente".
2. **Dependência excessiva de código Client-Side extenso:**
   - O arquivo `crm/clientes/page.tsx` possui mais de 1500 linhas combinando visualização, formulários e lógica de paginação/filtros. Isso torna a manutenção custosa e impacta na legibilidade.
3. **Múltiplas Formas de Gerir "Estado/Sessão":**
   - O uso de `global.mockSession` em alguns testes e instâncias denota que a equipe teve dificuldades de testar a autenticação real do Supabase SSR de forma contínua, necessitando de by-passes que podem escorrer para o ambiente de produção se não forem monitorados.

---

## 4. Próximas Tarefas Priorizadas

Para darmos continuidade com segurança e manutenibilidade, proponho o seguinte plano de ação:

- [ ] **P1:** Refatorar `crm/clientes/page.tsx` quebrando o código em componentes menores (ex.: `CustomerTable`, `CustomerForm`, `CustomerWalletTab`), aliviando o excesso de responsabilidades de um único arquivo.
- [x] **P2:** Remover ou concluir de vez a utilização de stubs (`legacy-firestore-stubs.ts`) e consolidar todo acesso unicamente ao Prisma Client. Remover as referências do Firebase App se já não estiver em uso.
- [x] **P3:** Finalizar os fluxos mockados identificados (como Cancelamento e Devolução de Venda/Estorno). O módulo financeiro precisa reagir a essas devoluções.
- [x] **P4:** Criar testes end-to-end (E2E) ou de integração para o PDV (Frente de caixa), pois uma falha de sincronização lá pode quebrar a experiência direta com o cliente na loja.
- [x] **P5:** Revisar o middleware do Next.js e as instâncias de cliente Supabase (`@supabase/ssr`) para garantir que o token JWT não expira indevidamente nas transições de PDV em janelas abertas por longo período.
