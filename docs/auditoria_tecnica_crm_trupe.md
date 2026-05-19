# AUDITORIA TÉCNICA COMPLETA & PLANO DE MIGRAÇÃO
## PROJETO: CRM TRUPE (CRManager)
**Data da Auditoria:** 18 de Maio de 2026  
**Status do Projeto:** Operacional (Firebase Firestore/Auth)  
**Objetivo:** Diagnóstico de Arquitetura e Modelagem Relacional para Supabase PostgreSQL + Prisma ORM  

---

## 1. STACK ATUAL

A análise do arquivo `package.json` e da estrutura de diretórios revela uma aplicação moderna no ecossistema React/Next.js, mas com forte acoplamento arquitetural à infraestrutura NoSQL do Firebase (Client-Side Database Access).

*   **Framework Frontend:** Next.js 15.5.9 executando sobre **React 19.2.1**.
*   **Framework Backend:** Ausência de um servidor backend dedicado ou API REST/GraphQL própria. A lógica de persistência e regras de negócio é executada quase integralmente no client-side (SPA), comunicando-se diretamente com o Firebase SDK. A aplicação utiliza o App Router do Next.js, mas as rotas atuam principalmente como renderizadoras de páginas estáticas e dinâmicas do lado do cliente (`"use client"`).
*   **Linguagem Utilizada:** TypeScript 5.9.3 (DevDependency).
*   **Gerenciador de Estado:** A aplicação não utiliza bibliotecas de estado global como Redux ou Zustand. O estado é gerenciado via:
    *   **React Context API** (`src/lib/contexts/profile-context.tsx` para o perfil ativo; `src/hooks/use-permissions.tsx` para controle de acesso).
    *   **Estado local (`useState`/`useMemo`)** associado a hooks customizados do Firebase.
    *   **Hooks de Sincronia Real-Time** (`useCollection` e `useDoc` em `src/firebase/firestore`), que atuam como gerenciadores de estado reativo diretamente conectados ao Firestore.
*   **ORM Atual:** Não aplicável (NoSQL). O acesso aos dados é feito através da biblioteca oficial `@firebase/firestore` por meio de chamadas diretas como `query()`, `collection()`, `doc()`, e `addDoc()`.
*   **Banco de Dados Atual:** Google Cloud Firestore (Banco NoSQL orientado a documentos).
*   **Sistema de Autenticação Atual:** Firebase Auth encapsulado com um fluxo de autenticação compartilhada (Shared Authentication). O login é realizado via provedor Google (`GoogleAuthProvider`), seguido por uma seleção de sub-perfis internos gerenciados em uma coleção Firestore e validados localmente por uma senha numérica de 4 dígitos (PIN).
*   **Bibliotecas Principais:**
    *   **Componentização e Interface:** Radix UI (acessibilidade), Tailwind CSS, Lucide React (ícones), Shadcn/UI (base para os componentes em `src/components/ui`), Embla Carousel.
    *   **Validação e Formulários:** React Hook Form (`^7.54.2`) e Zod (`^3.24.2`) para tipagem estática e validação em tempo de execução dos formulários de configurações e produtos.
    *   **Visualização de Dados:** Recharts (`^2.15.1`) para renderização dos gráficos analíticos.
    *   **Manipulação de Arquivos e Datas:** XLSX (`^0.18.5`) para exportação/importação de planilhas de estoque, e Date-fns (`^3.6.0`) para tratamento de datas.
    *   **Inteligência Artificial:** Google Genkit (`^1.28.0`) e `@genkit-ai/google-genai` indicando integrações prontas ou em andamento com modelos do Google Gemini.
*   **Dependências Críticas:**
    *   `firebase` (`^11.10.0`): Acoplamento crítico de dados. Todo o fluxo de sincronização em tempo real e mutação de dados depende diretamente do SDK cliente.
    *   `next` (`15.5.9`): Estrutura de roteamento de páginas e compilação do projeto.

---

## 2. ESTRUTURA DE PASTAS (RESPONSABILIDADES)

A arquitetura do diretório `src/` segue as convenções modernas do Next.js, dividindo componentes de UI, páginas, hooks e lógica de banco de dados.

```mermaid
graph TD
    src[src/]
    src --> app[app/ - Rotas e Páginas]
    src --> components[components/ - UI e Views]
    src --> firebase[firebase/ - Inicialização e Hooks]
    src --> hooks[hooks/ - Utilitários Globais]
    src --> lib[lib/ - Negócio, Seeds e Contextos]
    src --> types[types/ - Tipos e Validações Zod]

    app --> dashboard[(dashboard) - Rotas do ERP]
    app --> login[login - Tela de Acesso]
    app --> selecionar_perfil[selecionar-perfil - PIN]
    
    components --> ui[ui/ - Componentes Shadcn]
    components --> layout[layout/ - Sidebar e Topbar]
```

### Mapeamento Detalhado e Responsabilidades:

*   **`src/app` (Rotas e Páginas):**
    *   `src/app/layout.tsx`: Arquivo raiz de layout da aplicação. Configura as fontes (Inter) e inicializa os provedores globais: `FirebaseClientProvider`, `ProfileProvider`, e `PermissionsProvider`.
    *   `src/app/(dashboard)/`: Grupo de rotas protegidas pelo layout do dashboard (`layout.tsx`). Contém as telas operacionais do ERP (produtos, clientes, financeiro, pdv, movimentações).
    *   `src/app/login/`: Página de login inicial. Executa a autenticação via Google e restringe o acesso aos e-mails autorizados.
    *   `src/app/selecionar-perfil/`: Interface de transição onde o operador escolhe seu perfil interno de trabalho e digita o PIN numérico.
    *   `src/app/configuracoes/`: Subpáginas dedicadas a parametrizações de negócio (usuários, dados da empresa, certificado digital, logs).
*   **`src/components` (Componentes Visuais):**
    *   `src/components/ui/`: Componentes atômicos e reutilizáveis baseados em Shadcn/UI (Button, Input, Select, Dialog, Card, Tabs, etc.).
    *   `src/components/layout/`: Elementos estruturais de navegação, como o `app-sidebar.tsx` (Menu lateral que avalia permissões para exibir opções) e `config-sidebar.tsx`.
    *   `src/components/produtos/` e `src/components/permissions/`: Modais e componentes auxiliares complexos associados a módulos específicos.
    *   `src/components/FirebaseErrorListener.tsx`: Componente invisível injetado no layout que escuta e notifica falhas e permissões negadas vindas do Firestore.
*   **`src/firebase` (Lógica de Conexão NoSQL):**
    *   `src/firebase/config.ts`: Contém as credenciais públicas do projeto Firebase e inicializa os serviços básicos.
    *   `src/firebase/provider.tsx`: Implementa o Contexto de Conectividade (`FirebaseContext`). Cria os hooks fundamentais `useUser()`, `useFirestore()`, e `useAuth()`.
    *   `src/firebase/firestore/`: Contém os hooks reativos `useCollection.tsx` (escuta tabelas inteiras) e `useDoc.tsx` (escuta documentos individuais).
*   **`src/hooks` (Lógica Reutilizável):**
    *   `src/hooks/use-permissions.tsx`: Gerencia as regras de RBAC da sessão ativa. Lê o perfil do usuário, valida se ele é um "Admin Root" ou resolve a matriz de permissões associada ao grupo dele para autorizar navegações.
    *   `src/hooks/use-toast.ts` e `use-mobile.tsx`: Hooks utilitários de interface.
*   **`src/lib` (Negócio, Seeds e Contextos):**
    *   `src/lib/contexts/profile-context.tsx`: Gerencia o estado persistido do perfil ativo no `localStorage` sob a chave `@crmanager:activeProfile`.
    *   `src/lib/crm-service.ts`: Abstração de persistência (CRUD). Funciona como um "pseudo-ORM" para o Firestore, padronizando campos de auditoria (criado_em, atualizado_por), gravando histórico de clientes (`historico_cliente`) e disparando logs de atividades (`logs_atividades`).
    *   `src/lib/seeds/`: Scripts de inicialização. `crm.ts` insere as tags padrão se o banco estiver limpo, e `financeiro.ts` popula o Plano de Contas padrão e Métodos de Pagamento.
*   **`src/types` (Modelagem de Dados e Validações Zod):**
    *   `src/types/configuracoes.ts`: Define os schemas Zod e tipos TypeScript para Empresa, Configurações Gerais, PDV, Usuários, Grupos e Logs.
    *   `src/types/crm.ts` e `src/types/financeiro.ts`: Interfaces puras que definem a estrutura de dados das coleções de CRM e Finanças.

---

## 3. MAPEAMENTO COMPLETO DO BANCO DE DADOS ATUAL (FIRESTORE)

Como o Firestore é um banco NoSQL estruturado em coleções contendo documentos JSON flexíveis, as relações são tratadas implicitamente por strings armazenando IDs. O sistema adota a estratégia de "Flat Collections" (coleções na raiz do banco) para facilitar consultas complexas.

| Coleção Firestore | Relações Implícitas (Campos de Junção) | Campos Principais | Duplicação de Dados / Problemas Identificados |
| :--- | :--- | :--- | :--- |
| **`usuarios`** | `empresa_id` -> `configuracoes_empresa`<br>`grupo_id` -> `grupos_usuarios` | `nome`, `email`, `cargo`, `status`, `pin_acesso`, `permitir_acesso` | Senha PIN de 4 dígitos armazenada em texto plano no banco de dados. Risco grave de vazamento de credenciais. |
| **`grupos_usuarios`** | `empresa_id` -> `configuracoes_empresa` | `nome`, `descricao`, `status`, `is_admin` | Risco de deleção de grupo que possua usuários ativos vinculados (falta de cascata). |
| **`permissoes_grupo`**| `grupo_id` -> `grupos_usuarios` | `matriz` (JSON contendo regras de permissão por módulo) | A matriz de permissões é um JSON genérico sem validação estática no banco. |
| **`clientes`** | `tenant_id` -> `configuracoes_empresa` | `nome`, `email`, `telefone`, `documento`, `endereco`, `status` | Ausência de validação rígida de documento único (CPF/CNPJ) a nível de banco. |
| **`filhos`** | `cliente_id` -> `clientes` | `nome`, `data_nascimento`, `genero` | Relação 1:N simulada. A exclusão de um cliente deixa registros órfãos na coleção de filhos. |
| **`carteiras_clientes`**| `cliente_id` -> `clientes` | `saldo_atual` | Saldo armazenado de forma estática. Pode divergir do somatório real das movimentações se houver falha de concorrência. |
| **`movimentacoes_saldo`**| `carteira_id` -> `carteiras_clientes`<br>`referencia_id` -> `vendas` / `devolucoes` | `tipo` ('entrada'/'saida'), `valor`, `descricao` | A referência a outras coleções é genérica e depende do frontend para ser resolvida. |
| **`tags`** | `tenant_id` -> `configuracoes_empresa` | `nome`, `cor`, `status` | Tags globais reinseridas por Tenant no processo de Seed. |
| **`clientes_tags`** | `cliente_id` -> `clientes`<br>`tag_id` -> `tags` | `cliente_id`, `tag_id` | Tabela de ligação (N:M) simulada em NoSQL. Gera custos adicionais de leitura (Read Quota) para cada tag renderizada no perfil do cliente. |
| **`historico_cliente`**| `cliente_id` -> `clientes` | `tipo_acao`, `descricao`, `created_by` | Apenas texto descritivo simples; não há metadados estruturados das alterações realizadas. |
| **`produtos`** | `fornecedorId` -> `fornecedores`<br>`grupo` -> `gruposProdutos` | `nome`, `codigoInterno`, `codigoBarras`, `valorVenda`, `estoqueAtual`, `marca` | Permite duplicação de códigos de barra. O estoque é atualizado de forma direta e sem concorrência garantida. |
| **`produtos/{id}/historico_precos`** | Subcoleção de `produtos` | `dataAlteracao`, `valorAntigo`, `valorNovo` | Modelado como subcoleção física do Firestore. Dificulta relatórios analíticos globais de inflação de preços. |
| **`movimentacoes_estoque`**| `produtoId` -> `produtos` | `dataHora`, `tipo`, `qntMovim`, `qntFinal`, `custoUnit`, `custoTotal`, `descricao` | Risco de dados órfãos se o produto associado for deletado. |
| **`vendas`** | `vendedorId` -> `vendedores`<br>`clienteId` -> `clientes` | `dataVenda`, `valorTotal`, `itens` (Array nested JSON), `pagamentos` | Itens e pagamentos são armazenados como sub-objetos aninhados. Dificulta relatórios fiscais por item vendido. |
| **`bank_accounts`** | `empresaId` -> `configuracoes_empresa` | `name`, `type`, `initialBalance`, `currentBalance`, `status` | Saldo dinâmico exposto a race conditions por concorrência de lançamentos simultâneos no PDV. |
| **`accounts_payable`** | `supplierId` -> `fornecedores`<br>`bankAccountId` -> `bank_accounts` | `description`, `amount`, `paidAmount`, `dueDate`, `paymentDate`, `status` | Falta de chave estrangeira garante inconsistência em remoção de contas correntes ou fornecedores. |
| **`accounts_receivable`**| `clientId` -> `clientes`<br>`saleId` -> `vendas`<br>`bankAccountId` -> `bank_accounts` | `description`, `amount`, `receivedAmount`, `dueDate`, `status` | Idem a contas a pagar. Vínculos de parcelamento frágeis. |
| **`financial_transactions`**| `bankAccountId` -> `bank_accounts`<br>`referenceId` -> `vendas`/`contas` | `type` ('INCOME'/'EXPENSE'), `amount`, `date`, `status` | Rastreabilidade manual. Não há amarração nativa de conciliação bancária. |
| **`cash_registers`** | `userId` -> `usuarios` | `userName`, `openedAt`, `closedAt`, `initialBalance`, `currentBalance`, `status` | Armazena `userName` de forma estática (duplicado). Se o usuário mudar de nome, o log do caixa fica defasado. |

---

## 4. FLUXO DE AUTENTICAÇÃO E SESSÃO

O fluxo de autenticação atual apresenta um alto nível de acoplamento a rotinas em memória do cliente e possui **vulnerabilidades críticas de segurança**.

```
[ Usuário entra no App ]
         │
         ▼
[ Login com Google ] ──► (Valida no Frontend se E-mail está no Array)
         │                   │
         │ (Autorizado)      └──► [ Acesso Negado / Sign Out ] (Se não estiver no Array)
         ▼
[ Selecionar Perfil ] ──► (Busca usuários ATIVOS com empresa_id == "trupe-kids")
         │
         ▼
[ Digita PIN (4 dígitos) ]
         │
         ├─► (PIN Incorreto) ──► Bloqueia Acesso
         │
         └─► (PIN Correto)
                 │
                 ▼
     [ Grava login_sessions ]
     [ Grava activeProfile no LocalStorage ]
     [ Injeta Contexto e Renderiza Dashboard ]
```

### Análise dos Componentes do Fluxo:
1.  **Tela de Login (`src/app/login/page.tsx`):**
    *   O usuário realiza a autenticação via pop-up do Google Auth.
    *   O frontend intercepta o e-mail retornado e o compara com uma constante rígida (`ALLOWED_EMAILS`):
        ```typescript
        const ALLOWED_EMAILS = ['felypenaiff01@gmail.com', 'trupekidsmcp@gmail.com']
        ```
    *   **Se o e-mail não constar na lista**, a aplicação chama `signOut(auth)` no cliente e rejeita o login.
2.  **Sessão e Seleção de Perfil (`src/app/selecionar-perfil/page.tsx`):**
    *   Uma vez autenticado sob uma das duas contas administradoras acima, o app busca na coleção Firestore `usuarios` todos os documentos onde `empresa_id == "trupe-kids"` e `status == "ATIVO"`.
    *   O operador seleciona seu nome (ex: "Caixa 01", "Gerente", "Vendedor X").
    *   A aplicação abre um modal solicitando o PIN de 4 dígitos.
    *   O PIN digitado é verificado **diretamente no frontend** contra a propriedade `pin_acesso` do documento do usuário baixado do Firestore:
        ```typescript
        if (pin !== selectedUserForPin.pin_acesso) {
          setPinError("Senha incorreta para este perfil.");
          return;
        }
        ```
    *   Se a comparação for bem-sucedida, um registro de auditoria é criado na coleção `login_sessions` e o objeto contendo o perfil selecionado é salvo no `localStorage` (`@crmanager:activeProfile`).
3.  **Controle de Rotas e Middleware:**
    *   **Inexistência de Middleware:** O projeto **não possui** um arquivo `middleware.ts` do Next.js. Toda a segurança de rotas é realizada client-side no arquivo `src/app/(dashboard)/layout.tsx` e no menu de navegação `app-sidebar.tsx`.
    *   O `layout.tsx` apenas valida se `user` (Google Auth) e `activeProfile` (Perfil Local) estão presentes. Se sim, renderiza as páginas filhas sem verificar qual é a sub-rota que o usuário está tentando acessar.

### Pontos Inseguros Críticos Identificados:

> [!CAUTION]
> **Vulnerabilidade 1: Compartilhamento de Credenciais Administrativas do Google (Shared Auth)**
> Como apenas dois e-mails administradores são aceitos no login, **todos os funcionários da loja física (gerentes, caixas, vendedores) obrigatoriamente precisam compartilhar a mesma conta Google** (`trupekidsmcp@gmail.com`) ou manter sessões navegando sob essa credencial.
> *   **Impacto:** Rastreabilidade zero de acessos. No nível do Firebase Auth, todas as conexões ao banco de dados usam o mesmo UID. Um caixa pode realizar operações destrutivas no banco de dados e o Firestore registrará que a ação foi efetuada pelo e-mail mestre da loja.

> [!CAUTION]
> **Vulnerabilidade 2: Validação de PIN no Frontend**
> O PIN é retornado como parte do documento do usuário na consulta do Firestore e a comparação é feita via javascript no navegador do usuário.
> *   **Impacto:** Um operador malicioso com conhecimentos básicos de DevTools pode inspecionar o estado do componente ou interceptar a resposta do Firestore para obter os PINs de todos os usuários cadastrados e logar como Administrador.

> [!CAUTION]
> **Vulnerabilidade 3: Inexistência de Proteção Real de Rotas (Route Guarding)**
> O hook `canAccessRoute()` é consumido apenas pelo componente `app-sidebar.tsx` para filtrar os itens visuais do menu.
> *   **Impacto:** O arquivo `src/app/(dashboard)/layout.tsx` não realiza bloqueios. Se um usuário logado como Perfil "Caixa" digitar manualmente a URL `/financeiro` ou `/configuracoes/usuarios` na barra de endereços do navegador, a página será carregada e exibida normalmente, pois os arquivos de página não possuem validação de permissão isolada.

---

## 5. MAPEAMENTO DOS MÓDULOS DO ERP

| Módulo | Status Atual | Integrações Existentes | Dependências Identificadas | Acoplamentos e Complexidades |
| :--- | :--- | :--- | :--- | :--- |
| **Usuários** | Operacional | Cadastro simples vinculando ao `grupos_usuarios`. | `grupos_usuarios` | Acoplado à estrutura de autenticação compartilhada. Não permite múltiplos e-mails reais de login. |
| **Permissões** | Operacional | Matriz de permissões por grupo salva no Firestore. | `permissoes_grupo` | Puramente visual. A matriz oculta botões e links no sidebar, mas não impede requisições ao banco. |
| **Clientes** | Operacional | Integra com CRM, Histórico e Vendas. | `logs_atividades`, `historico_cliente` | Acoplamento moderado. Relação com tags e saldos é tratada via tabelas NoSQL separadas. |
| **Filhos** | Operacional | Vínculo direto de dependência familiar. | `clientes` | Depende da integridade do ID do cliente pai. Risco de órfãos na remoção do pai. |
| **Produtos** | Operacional | Controle de cadastro, variações e grupos. | `fornecedores`, `gruposProdutos`, `gradesVariacoes`, `unidadesProdutos` | Módulo pesado. Possui grande volume de leitura para buscar entidades de lookup auxiliares. |
| **Estoque** | Operacional | Ajuste manual de quantidade física. | `produtos`, `movimentacoes_estoque` | Acoplamento crítico. O estoque é salvo diretamente no produto como número estático e alterado de forma concorrente sem isolamento. |
| **Vendas & PDV** | Operacional | Abertura/fechamento de caixas e emissão. | `cash_registers`, `usuarios`, `clientes`, `produtos` | Módulo de maior complexidade. Salva itens no corpo da venda e gera contas a receber no financeiro. |
| **Financeiro** | Operacional | Contas a pagar/receber, fluxo e bancos. | `bank_accounts`, `payment_methods`, `chart_of_accounts`, `fornecedores`, `clientes` | Alto acoplamento com o PDV para gerar recebíveis automáticos baseados nas taxas das bandeiras de cartões. |
| **Dashboards** | Operacional | Exibição de kpis de faturamento e CRM. | `vendas`, `clientes`, `movimentacoes_estoque` | Gargalo de processamento. Lê e filtra grandes volumes de registros em memória no client-side. |
| **Trocas / Devol.** | Operacional | Emissão de vales e estornos de itens. | `vendas`, `clientes`, `carteiras_clientes` | Gera créditos na carteira do cliente, exigindo concorrência limpa para evitar duplicidade de saldos. |
| **Metas** | Planejado/Inicial| Estruturas de metas mensais de vendedores. | `vendedores`, `vendas` | Dependente do faturamento individual por vendedor logado. |
| **Configurações**| Operacional | Controle de dados da empresa e fiscais. | `configuracoes_empresa`, `configuracoes_pdv`, `configuracoes_fiscal` | Centraliza as variáveis de controle operacional de todo o sistema. |

---

## 6. ANÁLISE DE PERFORMANCE

O modelo arquitetural "Direct-to-Firestore" (sem backend intermediário) gera problemas latentes de performance conforme o volume de dados da loja cresce.

1.  **Gargalo de Sobrecarga de Memória e Rede (Falta de Paginação Real):**
    *   Na página de listagem de produtos (`src/app/(dashboard)/produtos/page.tsx`), a query é realizada sem paginação física no banco de dados (`limit()`):
        ```typescript
        const produtosQuery = useMemoFirebase(() => {
          return db ? query(collection(db, "produtos"), orderBy("createdAt", "desc")) : null
        }, [db])
        const { data: produtos, isLoading, error } = useCollection(produtosQuery)
        ```
    *   **Problema:** Toda a base de produtos é baixada de uma só vez para o navegador do cliente. Quando a loja atingir milhares de produtos cadastrados, o tempo de inicialização da página travará o navegador do operador do caixa, além de gerar uma cobrança financeira explosiva do Firebase (corte de Read Quotas).
2.  **Renders Excessivos e Recálculos em Loops:**
    *   O hook `processedProdutos` em `produtos/page.tsx` executa ordenação, filtros de marca, busca avançada por strings e conversões de moeda em memória sobre toda a lista de produtos a cada renderização da tela.
    *   Lookups internos (como cruzar o `fornecedorId` do produto com a lista de fornecedores em memória para exibir o nome fantasia) geram processamento quadrático ($O(N \times M)$) no frontend em cada ciclo de renderização.
3.  **Estado Global Inexistente / Conflitos de Concorrência:**
    *   Operações financeiras críticas (como decrementar saldo da conta bancária na liquidação de uma conta a pagar) realizam leituras seguidas de escritas sem o uso de **Transactions (transações atômicas)** do banco. Se dois caixas realizarem vendas ou baixas simultâneas no mesmo segundo, um saldo sobreescreverá o outro, gerando furos contábeis gravíssimos no fechamento do caixa.

---

## 7. ANÁLISE DE SEGURANÇA

A segurança é o calcanhar de Aquiles da atual arquitetura da aplicação. Como as decisões de negócio e acessos são tomadas no client-side, o banco NoSQL fica vulnerável.

### 1. Backdoor / Ignorador de Segurança Hardcoded (use-permissions.tsx)

No hook de checagem de permissões (`src/hooks/use-permissions.tsx`, linhas 45-53), existe uma regra de bypass que anula completamente qualquer barreira de segurança e RBAC configurada no sistema para perfis específicos:

```typescript
// Bypass de segurança: Felype e Milena sempre têm acesso total (ROOT)
const nomeUpper = activeProfile.nome?.toUpperCase() || ""
const emailLower = activeProfile.email?.toLowerCase() || ""

if (nomeUpper.includes("FELYPE") || nomeUpper.includes("MILENA") || emailLower === "felypenaiff01@gmail.com") {
  setIsAdminRoot(true)
  setIsLoading(false)
  return
}
```

> [!WARNING]
> **Risco de Exploração:** Se qualquer funcionário cadastrado no sistema alterar seu próprio nome de perfil para incluir a palavra `"FELYPE"` ou `"MILENA"` (ou modificar o LocalStorage localmente no navegador), o hook identificará a string e concederá status de `isAdminRoot` na hora. O usuário passará a visualizar todos os menus do financeiro, faturamento, logs e configurações, com acesso irrestrito de escrita no banco de dados.

### 2. Validações Ausentes a Nível de Banco de Dados:
*   **Regra Coringa Insegura nas Firestore Rules:**
    As regras do Firestore possuem um matcher genérico para coleções no final do arquivo:
    ```javascript
    match /{collection}/{documentId} {
      allow read: if isAuthenticated() && checkTenantAccess(resource.data);
      allow create: if isAuthenticated() && checkTenantAccess(request.resource.data);
      allow update: if isAuthenticated() && checkTenantAccess(resource.data) && checkTenantAccess(request.resource.data);
    }
    ```
    *   **Falha:** Como `checkTenantAccess` valida apenas se a propriedade `empresaId == request.auth.uid` (ou se é o administrador mestre logado), e os funcionários acessem o app usando a conta Google administrativa compartilhada, **qualquer funcionário autenticado na máquina da loja tem permissão de leitura, escrita e atualização irrestrita em qualquer tabela do banco de dados**, ignorando qualquer limitação de perfil (vendedor/caixa).
*   **Manipulação Indevida de Estoque:**
    Não há validação que garanta que a quantidade movimentada no estoque seja equivalente à alteração física. Um operador malicioso pode fazer uma chamada direta de alteração de estoque (via console do desenvolvedor) e setar a quantidade de produtos para qualquer valor arbitrário, sem disparar logs reais ou passar por validações de entrada.

---

## 8. PREPARAÇÃO PARA SUPABASE

A migração para o **Supabase PostgreSQL** trará robustez relacional, integridade de transações contábeis, segurança baseada em servidor e controle individualizado de acessos (Row Level Security - RLS).

```mermaid
graph LR
    subgraph Atual (Inseguro)
        Client[Navegador Cliente] -->|Direct Auth Mestre| Firestore[(NoSQL Firestore)]
        Client -->|Valida PIN e Bypass| Frontend[Lógica Cliente]
    end
    subgraph Recomendado (Seguro)
        Client2[Navegador Cliente] -->|Sessão Individual JWT| SupabaseAuth[Supabase Auth]
        Client2 -->|Queries via Prisma| NextBackend[Next.js API / Server Actions]
        NextBackend -->|Controle de Acesso RLS| SupabasePG[(PostgreSQL)]
    end
```

### O que pode ser reutilizado:
*   **Componentes de UI:** Toda a biblioteca visual desenvolvida (`src/components/ui`, layout com Tailwind CSS, tabelas de alta densidade estilo ERP) será 100% mantida.
*   **Gerenciamento de Formulários:** As schemas de validação Zod e o controle de formulários com React Hook Form.

### O que precisará ser refeito/substituído:
*   **Camada de Conectividade:** Excluir os arquivos em `src/firebase/*` e desinstalar o SDK cliente do Firebase.
*   **Hooks de Consulta:** Substituir `useCollection` e `useDoc` por chamadas controladas via API Routes / Server Actions do Next.js ou queries controladas usando **React Query (TanStack Query)** conectadas diretamente ao cliente Supabase.
*   **Gestão de Sessão (Auth):** Substituir a autenticação compartilhada por contas individuais para cada operador no Supabase Auth.
*   **Validação de PIN:** O PIN de 4 dígitos deve ser mantido como uma facilidade operacional de "troca rápida de operador" no caixa (POS), mas a validação dele deve ocorrer obrigatoriamente do lado do servidor (Server-Side hashing/checking) e não no Javascript do cliente.

### O que deve virar Prisma ORM:
*   Todas as coleções NoSQL devem ser mapeadas em tabelas SQL fortemente tipadas, usando chaves primárias (`PRIMARY KEY`), chaves estrangeiras (`FOREIGN KEY`) com regras de `ON DELETE RESTRICT` (para evitar dados órfãos) e campos auto-incrementados ou UUIDs.

---

## 9. MODELAGEM IDEAL POSTGRESQL (PRISMA SCHEMA)

Abaixo está o mapeamento conceitual das entidades traduzidas do NoSQL para o modelo relacional SQL, implementadas em formato de arquivo de schema do **Prisma ORM**.

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// SEGURANÇA E ACESSOS (RBAC & TENANCY)
// ==========================================

model Company {
  id               String               @id @default(uuid())
  cnpjCpf          String               @unique @map("cnpj_cpf")
  razaoSocial      String               @map("razao_social")
  nomeFantasia     String               @map("nome_fantasia")
  tipoPessoa       String               @default("PJ") @map("tipo_pessoa")
  telefone         String?
  email            String?
  createdAt        DateTime             @default(now()) @map("created_at")
  updatedAt        DateTime             @updatedAt @map("updated_at")
  
  users            User[]
  roles            Role[]
  customers        Customer[]
  products         Product[]
  bankAccounts     BankAccount[]
  generalConfigs   GeneralConfig?
  pdvConfigs       PdvConfig?
  fiscalConfigs    FiscalConfig?
  paymentMethods   PaymentMethod[]
  chartOfAccounts  ChartOfAccount[]
  costCenters      CostCenter[]
  sales            Sale[]
  activityLogs     ActivityLog[]
  sellerGoals      SellerGoal[]

  @@map("companies")
}

model Role {
  id          String       @id @default(uuid())
  companyId   String       @map("company_id")
  name        String
  description String?
  isAdmin     Boolean      @default(false) @map("is_admin")
  status      String       @default("ACTIVE")
  createdAt   DateTime     @default(now()) @map("created_at")
  
  company     Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  users       User[]
  permissions Permission[]

  @@unique([companyId, name])
  @@map("roles")
}

model Permission {
  id          String   @id @default(uuid())
  roleId      String   @map("role_id")
  module      String   // Ex: "Vendas", "Estoque", "Financeiro"
  action      String   // Ex: "create", "read", "update", "delete"
  allowed     Boolean  @default(false)

  role        Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, module, action])
  @@map("permissions")
}

model User {
  id             String         @id @default(uuid())
  companyId      String         @map("company_id")
  roleId         String?        @map("role_id")
  name           String
  email          String         @unique
  pinAccessHash  String         @map("pin_access_hash") // PIN armazenado de forma segura via Hash BCrypt
  status         String         @default("ACTIVE") // ACTIVE, INACTIVE, BLOCKED
  cargo          String?
  permitirAcesso Boolean        @default(true) @map("permitir_acesso")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  company        Company        @relation(fields: [companyId], references: [id], onDelete: Restrict)
  role           Role?          @relation(fields: [roleId], references: [id], onDelete: SetNull)
  cashRegisters  CashRegister[]
  activityLogs   ActivityLog[]

  @@map("users")
}

// ==========================================
// MÓDULO DE CRM & CLIENTES
// ==========================================

model Customer {
  id           String         @id @default(uuid())
  companyId    String         @map("company_id")
  name         String
  email        String?
  phone        String?
  document     String?        // CPF/CNPJ
  address      String?
  status       String         @default("ativo")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  company      Company        @relation(fields: [companyId], references: [id], onDelete: Restrict)
  children     Child[]
  storeCredit  StoreCredit?
  sales        Sale[]
  receivables  AccountReceivable[]

  @@unique([companyId, document])
  @@map("customers")
}

model Child {
  id             String   @id @default(uuid())
  customerId     String   @map("customer_id")
  name           String
  birthDate      DateTime @map("birth_date")
  gender         String?
  createdAt      DateTime @default(now()) @map("created_at")

  customer       Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@map("children")
}

model StoreCredit {
  id             String              @id @default(uuid())
  customerId     String              @unique @map("customer_id")
  currentBalance Decimal             @default(0.00) @map("current_balance") @db.Decimal(12, 2)
  updatedAt      DateTime            @updatedAt @map("updated_at")

  customer       Customer            @relation(fields: [customerId], references: [id], onDelete: Cascade)
  movements      StoreCreditMovement[]

  @@map("store_credits")
}

model StoreCreditMovement {
  id            String      @id @default(uuid())
  storeCreditId String      @map("store_credit_id")
  type          String      // INCOME (Entrada), EXPENSE (Saída)
  amount        Decimal     @db.Decimal(12, 2)
  description   String?
  referenceId   String?     @map("reference_id") // ID da Venda ou Devolução que gerou
  createdAt     DateTime    @default(now()) @map("created_at")

  storeCredit   StoreCredit @relation(fields: [storeCreditId], references: [id], onDelete: Cascade)

  @@map("store_credit_movements")
}

// ==========================================
// MÓDULO DE PRODUTOS E ESTOQUE
// ==========================================

model Product {
  id             String           @id @default(uuid())
  companyId      String           @map("company_id")
  name           String
  internalCode   String?          @map("internal_code")
  barCode        String?          @map("bar_code")
  salePrice      Decimal          @map("sale_price") @db.Decimal(10, 2)
  costPrice      Decimal          @default(0.00) @map("cost_price") @db.Decimal(10, 2)
  brand          String?
  status         String           @default("ativo")
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  company        Company          @relation(fields: [companyId], references: [id], onDelete: Restrict)
  inventory      Inventory?
  saleItems      SaleItem[]
  priceHistory   PriceHistory[]

  @@unique([companyId, barCode])
  @@unique([companyId, internalCode])
  @@map("products")
}

model PriceHistory {
  id             String   @id @default(uuid())
  productId      String   @map("product_id")
  oldPrice       Decimal  @map("old_price") @db.Decimal(10, 2)
  newPrice       Decimal  @map("new_price") @db.Decimal(10, 2)
  changeDate     DateTime @default(now()) @map("change_date")

  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("price_histories")
}

model Inventory {
  id             String             @id @default(uuid())
  productId      String             @unique @map("product_id")
  currentStock   Decimal            @default(0.00) @map("current_stock") @db.Decimal(10, 2)
  updatedAt      DateTime           @updatedAt @map("updated_at")

  product        Product            @relation(fields: [productId], references: [id], onDelete: Cascade)
  movements      InventoryMovement[]

  @@map("inventories")
}

model InventoryMovement {
  id          String    @id @default(uuid())
  inventoryId String    @map("inventory_id")
  type        String    // Ex: "ENTRADA", "SAIDA"
  quantity    Decimal   @db.Decimal(10, 2)
  finalStock  Decimal   @map("final_stock") @db.Decimal(10, 2)
  unitCost    Decimal   @map("unit_cost") @db.Decimal(10, 2)
  totalCost   Decimal   @map("total_cost") @db.Decimal(12, 2)
  description String?
  createdAt   DateTime  @default(now()) @map("created_at")

  inventory   Inventory @relation(fields: [inventoryId], references: [id], onDelete: Cascade)

  @@map("inventory_movements")
}

// ==========================================
// MÓDULO DE VENDAS & FINANCEIRO
// ==========================================

model Sale {
  id             String          @id @default(uuid())
  companyId      String          @map("company_id")
  customerId     String?         @map("customer_id")
  cashRegisterId String?         @map("cash_register_id")
  totalAmount    Decimal         @map("total_amount") @db.Decimal(12, 2)
  discountAmount Decimal         @default(0.00) @map("discount_amount") @db.Decimal(12, 2)
  status         String          @default("COMPLETED") // COMPLETED, CANCELLED
  saleDate       DateTime        @default(now()) @map("sale_date")

  company        Company         @relation(fields: [companyId], references: [id], onDelete: Restrict)
  customer       Customer?       @relation(fields: [customerId], references: [id], onDelete: SetNull)
  cashRegister   CashRegister?   @relation(fields: [cashRegisterId], references: [id], onDelete: SetNull)
  items          SaleItem[]
  payments       Payment[]
  receivables    AccountReceivable[]

  @@map("sales")
}

model SaleItem {
  id             String   @id @default(uuid())
  saleId         String   @map("sale_id")
  productId      String   @map("product_id")
  quantity       Decimal  @db.Decimal(10, 2)
  unitPrice      Decimal  @map("unit_price") @db.Decimal(10, 2)
  totalPrice     Decimal  @map("total_price") @db.Decimal(12, 2)

  sale           Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product        Product  @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@map("sale_items")
}

model Payment {
  id              String        @id @default(uuid())
  saleId          String        @map("sale_id")
  paymentMethodId String        @map("payment_method_id")
  amount          Decimal       @db.Decimal(12, 2)
  createdAt       DateTime      @default(now()) @map("created_at")

  sale            Sale          @relation(fields: [saleId], references: [id], onDelete: Cascade)
  paymentMethod   PaymentMethod @relation(fields: [paymentMethodId], references: [id], onDelete: Restrict)

  @@map("payments")
}

model CashRegister {
  id             String                 @id @default(uuid())
  userId         String                 @map("user_id")
  openedAt       DateTime               @default(now()) @map("opened_at")
  closedAt       DateTime?              @map("closed_at")
  initialBalance Decimal                @map("initial_balance") @db.Decimal(12, 2)
  currentBalance Decimal                @map("current_balance") @db.Decimal(12, 2)
  status         String                 @default("OPEN") // OPEN, CLOSED
  notes          String?

  user           User                   @relation(fields: [userId], references: [id], onDelete: Restrict)
  sales          Sale[]
  transactions   FinancialTransaction[]

  @@map("cash_registers")
}

model BankAccount {
  id             String                 @id @default(uuid())
  companyId      String                 @map("company_id")
  name           String
  type           String                 // CHECKING, SAVINGS, CASH, INVESTMENT
  initialBalance Decimal                @map("initial_balance") @db.Decimal(12, 2)
  currentBalance Decimal                @map("current_balance") @db.Decimal(12, 2)
  status         String                 @default("ACTIVE")
  createdAt      DateTime               @default(now()) @map("created_at")

  company        Company                @relation(fields: [companyId], references: [id], onDelete: Restrict)
  payables       AccountPayable[]
  receivables    AccountReceivable[]
  transactions   FinancialTransaction[]

  @@map("bank_accounts")
}

model AccountPayable {
  id             String               @id @default(uuid())
  description    String
  amount         Decimal              @db.Decimal(12, 2)
  paidAmount     Decimal              @default(0.00) @map("paid_amount") @db.Decimal(12, 2)
  dueDate        DateTime             @map("due_date")
  paymentDate    DateTime?            @map("payment_date")
  status         String               @default("PENDING") // PENDING, PAID, OVERDUE, CANCELLED
  bankAccountId  String?              @map("bank_account_id")
  createdAt      DateTime             @default(now()) @map("created_at")

  bankAccount    BankAccount?         @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)

  @@map("accounts_payable")
}

model AccountReceivable {
  id             String               @id @default(uuid())
  companyId      String               @map("company_id")
  customerId     String?              @map("customer_id")
  saleId         String?              @map("sale_id")
  description    String
  amount         Decimal              @db.Decimal(12, 2)
  receivedAmount Decimal              @default(0.00) @map("received_amount") @db.Decimal(12, 2)
  dueDate        DateTime             @map("due_date")
  receiptDate    DateTime?            @map("receipt_date")
  status         String               @default("PENDING")
  bankAccountId  String?              @map("bank_account_id")
  createdAt      DateTime             @default(now()) @map("created_at")

  company        Company              @relation(fields: [companyId], references: [id], onDelete: Restrict)
  customer       Customer?            @relation(fields: [customerId], references: [id], onDelete: SetNull)
  sale           Sale?                @relation(fields: [saleId], references: [id], onDelete: SetNull)
  bankAccount    BankAccount?         @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)

  @@map("accounts_receivable")
}

model FinancialTransaction {
  id             String        @id @default(uuid())
  bankAccountId  String        @map("bank_account_id")
  cashRegisterId String?       @map("cash_register_id")
  type           String        // INCOME, EXPENSE, TRANSFER
  amount         Decimal       @db.Decimal(12, 2)
  date           DateTime      @default(now())
  description    String
  status         String        @default("COMPLETED")

  bankAccount    BankAccount   @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)
  cashRegister   CashRegister? @relation(fields: [cashRegisterId], references: [id], onDelete: SetNull)

  @@map("financial_transactions")
}

// ==========================================
// CONFIGURAÇÕES OPERACIONAIS AUXILIARES
// ==========================================

model PaymentMethod {
  id            String    @id @default(uuid())
  companyId     String    @map("company_id")
  name          String
  feePercentage Decimal   @default(0.00) @map("fee_percentage") @db.Decimal(5, 2)
  feeFixed      Decimal   @default(0.00) @map("fee_fixed") @db.Decimal(10, 2)
  receiptDays   Int       @default(0) @map("receipt_days")
  status        String    @default("ACTIVE")

  company       Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  payments      Payment[]

  @@map("payment_methods")
}

model ChartOfAccount {
  id            String   @id @default(uuid())
  companyId     String   @map("company_id")
  code          String
  name          String
  type          String   // REVENUE, EXPENSE
  parentId      String?  @map("parent_id")
  status        String   @default("ACTIVE")

  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("chart_of_accounts")
}

model CostCenter {
  id            String   @id @default(uuid())
  companyId     String   @map("company_id")
  name          String
  description   String?
  status        String   @default("ACTIVE")

  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("cost_centers")
}

model SellerGoal {
  id            String   @id @default(uuid())
  companyId     String   @map("company_id")
  targetAmount  Decimal  @map("target_amount") @db.Decimal(12, 2)
  monthYear     String   @map("month_year") // Format: MM-YYYY
  createdAt     DateTime @default(now()) @map("created_at")

  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("seller_goals")
}

// ==========================================
// TABELAS DE CONFIGURAÇÃO DE TENANT (METADADOS)
// ==========================================

model GeneralConfig {
  id                       String   @id @default(uuid())
  companyId                String   @unique @map("company_id")
  casasDecimaisValor       Int      @default(2) @map("casas_decimais_valor")
  casasDecimaisQuantidade  Int      @default(2) @map("casas_decimais_quantidade")
  registrosPorPagina       Int      @default(50) @map("registros_por_pagina")
  permitirVendaSemEstoque  Boolean  @default(false) @map("permitir_venda_sem_estoque")

  company                  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("general_configs")
}

model PdvConfig {
  id                       String   @id @default(uuid())
  companyId                String   @unique @map("company_id")
  emitirNfce               String   @default("DESABILITADO") @map("emitir_nfce")
  sempreIndicarVendedor    Boolean  @default(false) @map("sempre_indicar_vendedor")
  permitirDesconto         Boolean  @default(true) @map("permitir_desconto")
  limiteMaximoDesconto     Decimal  @default(10.00) @map("limite_maximo_desconto") @db.Decimal(5, 2)

  company                  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("pdv_configs")
}

model FiscalConfig {
  id                       String   @id @default(uuid())
  companyId                String   @unique @map("company_id")
  ambienteNfe              String   @default("HOMOLOGACAO") @map("ambiente_nfe")
  cscNfce                  String?  @map("csc_nfce")
  tokenNfce                String?  @map("token_nfce")

  company                  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("fiscal_configs")
}

model ActivityLog {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")
  userId      String   @map("user_id")
  action      String   // Ex: CREATE, UPDATE, DELETE
  module      String   // Ex: CRM, Financeiro, Estoque
  recordId    String?  @map("record_id")
  details     String?
  createdAt   DateTime @default(now()) @map("created_at")

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@map("activity_logs")
}

---

## 10. ROTEIRO DE MIGRAÇÃO (ROADMAP SEGURO)

A migração do ecossistema NoSQL (Firebase) para Relacional (Supabase PostgreSQL + Prisma) deve ocorrer em 4 fases incrementais para garantir risco mínimo de interrupção operacional na loja.

```
[ FASE 1: Infraestrutura ] ──► [ FASE 2: Autenticação ] ──► [ FASE 3: API & Telas ] ──► [ FASE 4: Go-Live & ETL ]
  • Setup Supabase & Prisma     • Contas Individuais         • API Routes & Prisma      • Bloqueio Firebase
  • Script de ETL (Seed)        • Hashing Server-Side PIN    • React Query Cache        • Sincronia Final & Auditoria
```

### FASE 1: INFRAESTRUTURA E PREPARAÇÃO DO MODELO (Sem interrupção)
*   **Ações:**
    1. Provisionamento do banco PostgreSQL no console do Supabase.
    2. Instalação e inicialização do Prisma ORM no projeto Next.js (`npm install @prisma/client` e `npm install prisma --save-dev`).
    3. Criação e execução da primeira migration para estruturar as tabelas físicas.
    4. Desenvolvimento do script de **ETL (Extract, Transform, Load)** em Node.js. Este script conecta na API cliente do Firestore, extrai todos os documentos, converte os IDs antigos (strings do Firestore) em chaves UUID consistentes, corrige formatos de data/hora e executa a carga relacional de teste.
*   **Prioridade:** Alta (Dependência inicial para todo o resto).
*   **Riscos:** Incompatibilidade de tipos NoSQL flexíveis com restrições SQL rígidas (ex: campos vazios que não podem ser nulos no SQL).
*   **Ordem Correta de Migração dos Dados:**
    `Company` ──► `Role` ──► `User` ──► `Customer` ──► `Child` ──► `BankAccount` ──► `PaymentMethod` ──► `ChartOfAccount` ──► `Product` ──► `Inventory` ──► `Sale` ──► `SaleItem` ──► `Payment` ──► `AccountReceivable` ──► `AccountPayable`.

### FASE 2: MIGRAÇÃO DA CAMADA DE AUTENTICAÇÃO E PERFIS
*   **Ações:**
    1. Criação das contas individuais para os funcionários no Supabase Auth (eliminando de vez a conta Google mestre compartilhada).
    2. Habilitação de **Row Level Security (RLS)** em todas as tabelas Supabase para garantir que usuários de uma empresa não acessem dados de outras.
    3. Hashing seguro e validação Server-Side do PIN de acesso rápido dos operadores, eliminando a verificação client-side.
*   **Riscos:** Bloqueio de acesso operacional de funcionários se as credenciais individuais não forem distribuídas antes da virada da tela de login.

### FASE 3: PORTABILIDADE DA CAMADA DE PERSISTÊNCIA (DADOS)
*   **Ações:**
    1. Substituição de todas as consultas diretas do Firestore (`useCollection`, `onSnapshot`) por chamadas controladas via API Routes ou Server Actions do Next.js consumindo o Prisma Client.
    2. Utilização de **React Query (TanStack Query)** para fazer cache local das consultas repetidas de busca de fornecedores, unidades e variações, otimizando drasticamente o carregamento.
    3. Refatoração dos módulos de Venda (PDV) e Estoque para usarem **Transações SQL Isoladas (`prisma.$transaction`)** garantindo consistência matemática absoluta em cenários de alta concorrência.
*   **Riscos:** Perda temporária de sincronia reativa (Tempo Real). (Contramedida: Usar WebSockets Supabase apenas no painel do PDV ou filas de impressão).

### FASE 4: CORTE DEFINITIVO (GO-LIVE) E AUDITORIA
*   **Ações:**
    1. Colocar o aplicativo Firebase em modo "Somente Leitura" (desativando regras de gravação).
    2. Rodar o script ETL de importação final contendo dados adicionais criados no período de transição.
    3. Executar auditoria de consistência matemática: validar saldo total das contas correntes, contas a pagar pendentes e estoque atual contra os saldos finais gerados pelo Firebase.
    4. Virada definitiva dos domínios (DNS) para a nova versão hospedada na Vercel + Supabase. Encerramento do projeto Firebase.

---

## 11. RELATÓRIO FINAL E RECOMENDAÇÕES

### Arquitetura Recomendada
*   **Camada de Dados:** Supabase PostgreSQL como banco de dados transacional ACID robusto.
*   **Acesso a Dados:** Prisma ORM como camada de mapeamento e abstração de consultas fortemente tipadas em TypeScript.
*   **Estado & Rede:** TanStack Query (React Query) para orquestração de requisições, paginação inteligente do lado do servidor e invalidação de cache local.
*   **Autenticação:** Supabase Auth com sessões individuais via JWT e segurança de tabelas via RLS.

### Melhorias Recomendadas
1.  **Segurança Remota (Server-Side checking):** Eliminar imediatamente o backdoor baseados nos nomes `"FELYPE"` ou `"MILENA"`. As checagens de permissão de rotas e operações sensíveis devem ser executadas a nível de requisição de API / Server Action e nunca apenas omitindo elementos da tela.
2.  **Transações e Fechamento de Caixa:** O PDV deve forçar transações isoladas para evitar estouro de saldo por concorrência simultânea.
3.  **Auditoria Nativa via Database Triggers:** Utilizar triggers nativas do PostgreSQL para popular a tabela `activity_logs` de forma automática nas mutações críticas, gerando uma trilha de auditoria imutável independente do Next.js.

### Estimativa de Complexidade da Migração
*   **Complexidade Geral:** **Média-Alta**.
*   **Justificativa:** A interface visual (componentes, modais de filtros, formulários estruturados Tailwind/Shadcn) é extremamente premium e de excelente qualidade, não necessitando de nenhuma alteração cosmética. O gargalo do esforço de engenharia reside unicamente na remoção completa do Firebase SDK acoplado diretamente em quase todas as telas do ERP em `src/app/(dashboard)/*`, exigindo a reescrita dessas integrações de dados para consumir endpoints baseados no Prisma ORM. O resultado final será um sistema de nível enterprise, 100% seguro, escalável e pronto para o crescimento contínuo da marca.
