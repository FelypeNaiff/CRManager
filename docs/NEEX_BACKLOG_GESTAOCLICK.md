# NEEX — backlog diferencial GestãoClick

Atualizado em 02/10/2026 a partir de três fontes: inspeção do checkout atual do NEEX, execução dos checks do projeto e navegação autenticada em modo somente leitura no GestãoClick. A Sprint A consolidou as fontes canônicas descritas abaixo.

Este documento substitui o inventário histórico de 31/05 como referência de planejamento. O relatório `NEEX_Analise_GestaoClick.md` continua sendo a referência funcional, mas seus prompts não devem ser executados linearmente sem esta matriz.

## 1. Estado validado do projeto

- 469 testes seguros aprovados no fechamento funcional da Sprint D.
- 11 testes persistentes aprovados em PostgreSQL 17.11 local isolado para a homologação da Sprint D.
- 7 testes persistentes adicionais aprovados para o núcleo estrutural da Sprint E.
- TypeScript aprovado com `tsc --noEmit`.
- Schema Prisma válido.
- RBAC, isolamento por empresa, auditoria e contexto de ator possuem cobertura relevante.
- Vendas, PDV, caixa, carteira, vendedores, comissões e retornos possuem regras transacionais reais; não devem ser reconstruídos a partir do zero.
- Os checks acima não substituem teste de interface, banco de homologação, impressão física ou homologação fiscal.

Classificações usadas:

- **Verificado:** implementação e testes atuais oferecem evidência suficiente.
- **Parcial:** há domínio real, mas faltam requisitos importantes.
- **Visual/stub:** existe rota ou tela, sem fluxo completo conectado.
- **Ausente:** não foi encontrado domínio implementado.
- **Bloqueado:** depende de decisão ou integração externa.

## 2. Matriz diferencial

| Área | Estado | Evidência atual no NEEX | Lacuna comprovada | Próxima entrega |
|---|---|---|---|---|
| Autenticação, tenant e RBAC | Verificado | `src/lib/auth`, `src/lib/permissions` e testes de tenant/permissão | Revisar permissões novas ao criar módulos; não trocar Supabase | Manutenção transversal |
| Auditoria | Verificado | eventos canônicos e transacionais em auth, produtos, vendas, retornos e financeiro | Cobrir futuros ajustes, transferências, inventários, importações e fiscal | Manutenção transversal |
| Empresa | Verificado no escopo A | `Company`, serviço único de atualização e telas de configuração, incluindo PF/PJ | Certificado, CSC e emissão fiscal pertencem à Sprint M | Sprint M |
| Configurações operacionais | Parcial forte | `OperationalSettings` é canônico para descontos, caixa, venda, carteira, comissão, metas e estoque negativo do PDV | Precisão, paginação, custo, impressão e numeração dependem de consumidores reais | Sprints E, G–H |
| Usuários e grupos | Verificado | gestão de papéis, permissões e proteção do último administrador | Acrescentar ações específicas sem ampliar privilégios por padrão | Sprint A/transversal |
| Funcionários/vendedores | Verificado no escopo B | `Seller` independente de login, cadastro pessoal/endereço, vínculo opcional com `User`, inativação histórica e seleção ativa | Foto/anexos aguardam infraestrutura segura; sem folha, ponto ou salário | Sprint C apenas para regras de produto |
| Comissões | Parcial forte | apuração Decimal sobre total líquido da venda, snapshots de base/taxa/política, liberação integral na obrigação e reversão atual | liberação por recebimento e pagamento financeiro aguardam vínculo confiável venda–parcela | Sprint J |
| Produtos e variantes | Parcial forte após Sprint C | `Product` cadastral e `ProductVariant` vendável; unidades, conversão, dimensões, fiscal cadastral, estoque máximo, múltiplos fornecedores e comissão por item modelados | UI completa dos novos campos e uso de conversão em compras dependem dos fluxos correspondentes | Sprints D–E |
| Tabelas de preço | Modelado, não operacional | tabelas e preços por variante são tenant-scoped; `ProductVariant.salePrice` continua canônico | seleção comercial e sincronização da tabela padrão não foram ligadas ao checkout | Sprint G |
| Importação XLSX | Implementada e validada em banco | prévia autoritativa, fingerprint/lease, transação por linha e 11 testes persistentes; políticas usam o writer de estoque da Sprint E | validação autenticada de rota e navegador permanece pendente; políticas adicionais seguem ocultas | Fechamento Sprint D |
| Estoque | Parcial forte após Sprint E | depósito estruturado, posição por variante, ledger, ajustes, transferência imediata/estorno e inventário com conflito por versão; 7 testes persistentes | interface operacional completa e navegador autenticado pendentes; custo médio não implementado | Fechamento Sprint E |
| Etiquetas | Visual/stub | rota `/etiquetas` sem geração real | modelos, geometria, seleção, PDF e teste físico | Sprint F |
| Venda comercial | Parcial forte | serviço canônico, snapshots, descontos, pagamentos, estoque, comissão, DRAFT e cancelamento | completar entrega/frete/anexos e alinhar comprovantes; evitar motor paralelo | Sprint G |
| PDV | Parcial forte | carrinho, busca incremental, rascunho, cliente rápido, caixa e finalização idempotente | refinar atalhos, comprovantes, conferência e experiência de scanner | Sprint H |
| Comprovante comercial | Parcial | venda persistida e infraestrutura de impressão | replicar separação observada: venda concluída, imprimir cupom e emitir NFC-e; texto configurável de troca | Sprint H |
| Trocas/devoluções | Parcial forte, com risco | serviços e testes para retorno parcial, estoque, carteira e comissão | três domínios concorrentes: `ExchangeReturn`, `SaleExchange` e `SaleReturn` | Sprint I, antes de novas telas |
| Carteira | Verificado para núcleo atual | créditos/débitos com tenant, autorização e auditoria | consolidar relação com retorno canônico e impedir exclusão de crédito consumido | Sprint I |
| Financeiro base | Parcial forte | contas, plano, centros, métodos, transações, recebíveis e caixa | formalizar fonte de verdade entre quatro modelos financeiros | Sprint J |
| Baixas e estornos | Parcial | recebíveis e liquidações existentes | transformar baixa em evento explícito/idempotente, incluindo parcial, juros, desconto e estorno | Sprint J |
| Fluxo de caixa | Parcial | lista real baseada em `FinancialTransaction` | previsto/realizado, saldo anterior, visão diária e detalhe reconciliável | Sprint K |
| DRE | Ausente | sem domínio ou tela equivalente | competência, categorias, CMV, deduções e detalhe explicável | Sprint K |
| Recorrência | Ausente | apenas tipos/indícios de interface | geração idempotente de títulos futuros, sem baixa automática | Sprint K |
| Conciliação | Ausente | sem fluxo funcional | importar OFX, prévia, deduplicação, correspondência e confirmação auditada | Sprint K |
| Relatórios comerciais | Parcial forte | vendas, produtos, margem, metas/comissões, trocas e créditos | normalizar retornos e ampliar definições/exports | Sprint L |
| Relatórios de estoque/cadastro | Parcial ou ausente | rotas gerais e alguns dados cadastrais | posição histórica, inventário, reposição, sem giro, ABC e catálogo cadastral | Sprint L |
| Fiscal | Visual/ausente | dados gerais de empresa e página de certificado | domínio NF-e/NFC-e, provedor, estados, numeração, XML, eventos e homologação | Sprint M, bloqueada por decisões externas |
| Migração | Parcial em scripts | scripts de importação e sanitização existentes | ensaio unificado, chaves legadas, reconciliação e rerun idempotente | Sprint N |

## 3. Evidências funcionais observadas no GestãoClick

### Produtos e estoque

- Produto possui abas Dados, Detalhes, Valores, Estoque, Fotos, Fiscal e Fornecedores.
- Há variações, composição, unidade de compra/venda, estoque e habilitação fiscal.
- A lista oferece importação, exportação, ajustes em massa e geração de etiquetas.
- Estoque separa movimentações, ajustes, transferências, compras/cotações e relatórios.
- Ajustes somam ou retiram vários itens e aparecem no histórico do produto.
- O catálogo de relatórios inclui estoque atual, inventário, cotações, compras, produtos comprados e serviços contratados.

### Financeiro

- Contas a pagar e receber são fluxos próprios.
- Fluxo de caixa possui Saldo, Resumo, Diário, Estatísticas e Demonstrativo.
- A tela distingue realizado, previsto e saldo anterior.
- A DRE separa receita bruta, deduções, impostos, comissões, devoluções, receita líquida, CMV, despesas e resultado.
- Conciliação aceita extrato OFX e oferece Open Finance; integração externa não é requisito inicial do NEEX.
- Transferência entre contas é um fluxo próprio e não deve virar receita/despesa.

### PDV e comprovante

- Após finalizar, o GestãoClick oferece ações independentes para nova venda, impressão do cupom e emissão de NFC-e.
- O cupom comercial apresenta empresa, pedido, data/hora, operador, cliente, itens, quantidade, valor unitário, desconto, total e pagamentos.
- O cupom informa que não é documento fiscal e inclui política de troca configurada pela loja.
- Reimpressão não pode repetir estoque, financeiro, caixa ou comissão.

### Etiquetas, fiscal e acesso

- Etiquetas possuem modelos salvos e geração separada.
- A conta usa modelos PIMACO A4048/A4248/A4348 e A4051/A4251/A4351; esses presets têm prioridade sobre editor genérico ilimitado.
- Fiscal separa notas de produtos, serviços, consumidor e compras.
- Configurações gerais separam Dados gerais, Numerações, Movimentações, Fiscal, Notificações, SMTP e Domínio próprio.
- Existem grupos Administração, VENDAS e Aux Administrativo com matriz de permissões por grupo.

## 4. Decisões arquiteturais obrigatórias

### 4.1 Retorno canônico

Antes de ampliar trocas, escolher um único agregado para retorno. A decisão deve definir:

- entidade raiz e itens;
- vínculo com venda original e nova venda de troca;
- quantidade elegível e retornada;
- condição/destino físico;
- crédito, reembolso ou cancelamento de obrigação;
- reversão de comissão;
- compatibilidade e migração dos outros dois modelos.

Nenhuma nova tela deve gravar em mais de um domínio de retorno.

### 4.2 Fonte financeira

Definir e testar estes papéis:

- `SalePayment`: acordo comercial e forma escolhida na venda;
- título/recebível: obrigação, parcelas, competência e vencimento;
- evento de liquidação: valor efetivamente baixado, data, conta, juros/desconto e chave idempotente;
- `FinancialTransaction`: razão financeira/contábil usada por fluxo e relatórios;
- `CashMovement`: movimento operacional do caixa aberto.

Uma venda gera obrigação uma vez; uma baixa movimenta caixa/banco uma vez. Cancelamento, retorno e estorno devem usar vínculos, nunca procurar apenas por descrição ou valor.

### 4.3 Estoque

O saldo não pode ser a única fonte histórica. Cada efeito deve ter:

- empresa, loja/depósito e variante;
- quantidade assinada;
- tipo e origem;
- documento e chave idempotente;
- usuário/ator e data;
- custo aplicável;
- reversão correlacionada quando houver.

Inventário usa uma posição de referência e não sobrescreve movimentos posteriores. Transferência usa duas pernas vinculadas.

## 5. Ordem revisada das entregas

### Sprint A — consolidação de configuração e acesso

Completar preferências tipadas, fonte única de empresa e catálogo de permissões. Preservar RBAC e auth atuais.

### Sprint B — funcionário e política de comissão

Concluída no escopo seguro. `Seller` continua canônico e pode existir sem login. CPF é opcional, validado e único por empresa; o vínculo com `User` também é opcional, tenant-safe e único. Inativação nunca exclui o histórico.

Novas comissões usam `Sale.totalAmount` — total líquido após descontos, sem somar percentuais ou criar regra por produto — e gravam snapshots da base, taxa e política. A taxa do funcionário prevalece quando positiva; caso contrário usa `OperationalSettings.defaultCommissionRate`. A política individual prevalece sobre a empresarial.

`ON_FINANCIAL_OBLIGATION` é a única liberação operacional nesta etapa e libera integralmente sem marcar pagamento. Os contratos `ON_FIRST_INSTALLMENT_RECEIVED`, `ON_FULL_SETTLEMENT` e `PROPORTIONAL_TO_RECEIPTS` estão modelados e testados, porém não são executados nem apresentados como fluxo financeiro enquanto não existir vínculo confiável entre venda, recebível e liquidação na Sprint J. Registros anteriores permanecem com snapshots nulos, identificáveis como legados e sem recálculo retroativo.

### Sprint C — produto completo

Implementada de forma aditiva, sem aplicar migrations. `Product` mantém dados comuns; `ProductVariant` mantém identidade vendável, código de barras, custo, preço, dimensões e estoque. A direção documentada da conversão é quantidade comprada × fator = quantidade na unidade de estoque; nenhum saldo histórico foi reinterpretado.

`ProductVariant.salePrice` e `costPrice` continuam fontes operacionais do PDV e vendas. Tabelas alternativas estão modeladas, mas ainda não são selecionáveis nem substituem o preço canônico. O fornecedor legado é preservado como principal e também registrado na relação múltipla.

Comissão segue produto → categoria → funcionário → empresa. Produto/categoria com percentual explícito zero significa sem comissão. Novas vendas rateiam o desconto global proporcionalmente, atribuem o resíduo ao último item e gravam base, taxa, valor e origem por item; a comissão agregada mantém a restrição única por venda. Registros históricos não são recalculados.

### Sprint D — importação idempotente

Implementação parcial segura: a tela deixou de executar gravação comercial direta e agora envia o XLSX ao servidor, que cria prévia persistida sem alterar produtos, preços, custos ou estoque. `ImportBatch` e `ImportBatchRow` registram tenant, ator, SHA-256 real do arquivo, fingerprint operacional único, parser, mapeamento, políticas, estados, contadores, dados e erros por linha. O vínculo único de movimento por linha foi preparado para idempotência. Corridas na criação do mesmo lote são contidas pelo índice único do fingerprint e recuperadas após `P2002`.

Identidade declarada: SKU, código de barras e código interno são todos confrontados por igualdade no tenant; divergência entre identificadores bloqueia a linha, código interno com várias variantes exige SKU/GTIN e duas linhas que resolvem a mesma variante são bloqueadas. Fórmulas e identificadores numéricos são rejeitados. Decimal exige formato declarado e preserva ausente, inválido e zero explícito. Conversão explícita: quantidade comprada × fator = quantidade de estoque. O modelo de fornecedores não contém mais colunas de credenciais.

Políticas modeladas: não alterar estoque, saldo inicial sem histórico, saldo-alvo com conferência e entrada adicional explícita. A UI mantém somente `NONE` habilitada. O núcleo `product-write-service` é reutilizado pelo cadastro comum e pelo importador; produto, variante, fornecedor, histórico de preço, movimento, auditoria e conclusão da linha participam da mesma transação. Confirmação usa transição condicional de estado. Linhas usam token e lease, conclusão condicionada à posse, não repetem `COMPLETED` e falhas permanecem retomáveis.

Estado de validação do fechamento D:

- **Implementado:** seleção de aba/formato/política, mapeamento editável, consulta autorizada por `batchId`, confirmação, processamento e retomada, fingerprint único e migration adicional compatível com histórico possivelmente aplicado.
- **Testado isoladamente:** parser decimal/identidade/conversão e invariantes estruturais de tenant, transação, lease, vínculo idempotente e conflito de saldo-alvo. A suíte comum cobre regressões de produto, vendas, PDV e comissões.
- **Validado em banco:** 11 testes persistentes aprovados no PostgreSQL 17.11 portátil `neex_test`, limitado a `127.0.0.1:55432`. Foram cobertos ausência de efeitos na prévia, fingerprint concorrente, dupla confirmação, claim concorrente, worker sem posse, retomada, rollback integral, tenant, recarga de permissões, `NONE` e as três políticas adicionais.
- **Habilitado na interface:** prévia e processamento com política `NONE`. `INITIAL_IF_NO_HISTORY`, `TARGET_BALANCE` e `ADDITIONAL_ENTRY` foram homologadas no núcleo persistente, mas continuam ocultas até validação ponta a ponta da rota autenticada e apresentação dos efeitos na interface.

### Homologação PostgreSQL isolada da Sprint D

Homologação realizada em 01/10/2026 com os binários portáteis PostgreSQL 17.11 fornecidos pela EDB e referenciados pela página oficial do PostgreSQL. O cluster usa diretório exclusivo em `C:\tmp`, autenticação SCRAM, escuta somente em `127.0.0.1:55432`, banco `neex_test` e senha aleatória mantida apenas em `.env.test.local`, arquivo ignorado pelo Git. As URLs normais não foram substituídas e o banco de produção não foi acessado.

As 26 migrations do repositório foram aplicadas no banco isolado, incluindo `20261001150000_sprint_b_seller_commission_policy`, `20261001170000_sprint_c_products_commercial_rules`, `20261001190000_sprint_d_import_batches` e `20261001210000_sprint_d_import_execution`; `prisma migrate status` confirmou o schema atualizado. A suíte persistente usa somente dados sintéticos e limpa o tenant criado ao final.

Evidência persistente: 11 testes aprovados em `product-import-postgres.integration.test.ts`. O núcleo transacional da Sprint D está homologado em PostgreSQL. Limitação restante: o teste de XLSX cobre arquivo real, fórmula e linhas originais, enquanto a autenticação de rota Server Action e a interação visual completa continuam cobertas por testes isolados/build, não por navegador conectado ao banco local. Por isso as políticas adicionais permanecem ocultas na interface.

### Sprint E — estoque estrutural

Implementada de forma aditiva e aplicada somente ao PostgreSQL local isolado. `StockPosition` é a fonte operacional por empresa, depósito e variante; `ProductVariant.currentStock/reservedStock/availableStock` permanece como projeção agregada de compatibilidade, atualizada na mesma transação. Físico representa unidades presentes, reservado não é saída física e disponível é físico menos reservado. A migration cria explicitamente `LOJA_PRINCIPAL`, reconcilia cada variante legada uma única vez e não reinterpreta movimentos anteriores.

O serviço `inventory-service` recebe a transação do chamador e centraliza posição, movimento assinado, projeção agregada e auditoria. Entradas usam quantidade física positiva, saídas negativa e reserva usa delta separado. Venda/cancelamento, troca/devolução, cadastro manual, importador canônico e importador legado foram ligados ao serviço. Consultas de produto/PDV/relatório continuam lendo a projeção agregada por compatibilidade; migração futura poderá derivá-la das posições, mas não existe segundo writer autorizado.

Matriz de consumidores:

| Consumidor | Escrita/leitura após E | Estado |
|---|---|---|
| Cadastro/ajuste manual | serviço canônico, depósito padrão explícito | implementado |
| Importação Sprint D e legado | serviço canônico dentro da transação da linha | persistente D aprovado |
| Venda/PDV e cancelamento | serviço canônico dentro da transação comercial | testes isolados/regressão |
| Troca e devolução compatíveis | serviço canônico; itens não revendáveis não retornam ao disponível | testes isolados/regressão; consolidação segue na Sprint I |
| Reserva | delta reservado separado do físico | persistente E aprovado |
| Produtos, PDV e relatórios | projeção agregada de `ProductVariant` | compatibilidade mantida |
| Extrato | consulta tenant-scoped, paginação e filtros no servidor | implementado; UI avançada pendente |

Ajustes suportam delta e saldo-alvo. Saldo-alvo exige a versão observada e rejeita qualquer movimento interveniente, mesmo que o saldo retorne ao valor anterior. Reversão cria nova operação correlacionada e única. Transferência imediata grava documento e duas pernas atômicas, preserva o agregado da empresa, é idempotente e possui estorno que revalida disponibilidade no destino. Inventário registra referência/versão, contagem e recontagem sem efeito no saldo; aprovação gera ajustes idempotentes e rejeita posição modificada durante a contagem. As permissões `MANAGE_WAREHOUSES`, `TRANSFER`, `COUNT` e `APPROVE_INVENTORY` são distintas, além de `VIEW` e `ADJUST`.

Concorrência usa versão otimista da posição; movimento, posição, projeção, documento e auditoria compartilham a transação. A migration `20261002120000_sprint_e_structured_inventory` foi a 27ª aplicada em `127.0.0.1:55432/neex_test`; produção não foi acessada. A suíte `inventory-postgres.integration.test.ts` aprovou 7 testes persistentes: reconciliação físico/reservado/disponível, ajuste idempotente e alvo obsoleto, concorrência, transferência/estorno, rollback integral, inventário sem efeitos/conflito/aprovação repetida e tenant.

Custo preserva `ProductVariant.costPrice`; movimentos aceitam snapshot quando há fonte confiável e mantêm `null` na ausência. Custo histórico desconhecido não vira zero e custo médio não é declarado funcional porque o domínio canônico de compras ainda não está consolidado. Unidade do movimento é explícita e nenhuma quantidade histórica foi convertida.

Estado de entrega E: schema, migration, núcleo, endpoints autorizados e operações essenciais da página `/estoque` estão implementados. A interface apresenta depósitos/posições e permite cadastrar depósito, ajustar, transferir, iniciar/salvar/aprovar contagens conforme RBAC. `/movimentacoes` usa paginação e filtros no servidor e mostra saldo anterior, entrada, saída e saldo final por posição. Os testes persistentes do núcleo passaram. Nenhuma exportação nova foi exposta nesta etapa; quando adicionada, deverá neutralizar fórmulas. A validação pelo navegador autenticado apontando para o banco local permanece pendente, portanto a Sprint E não está declarada totalmente homologada de ponta a ponta.

Tentativa de fechamento autenticado em 02/10/2026: o servidor Next.js 15.5.9 foi iniciado com `DATABASE_URL`, `DIRECT_URL` e `TEST_DATABASE_URL` sobrescritas somente no processo para `127.0.0.1:55432/neex_test`; o `.env` normal não foi editado. A aplicação local chegou à rota `/login`. O primeiro bloqueio, ausência da identidade NEEX no banco isolado, foi resolvido com tenant/papel/vínculo administrativos sintéticos apenas no `neex_test`. A tentativa seguinte alcançou o `signInWithPassword` suportado, mas o Supabase remoto configurado rejeitou a credencial. Nenhum bypass ou alteração no Supabase foi feito. Assim, nenhum cenário D–E foi marcado como validado pelo navegador.

Lint do fechamento: `eslint@8.57.1` e `eslint-config-next@15.5.9` foram instalados e `.eslintrc.json` usa o preset oficial `next/core-web-vitals`, sem exceções globais. `npm run lint` concluiu com código 0, sem erros e com 12 avisos preexistentes; `tsc --noEmit` também foi aprovado. Foram corrigidos dois erros reais encontrados na primeira execução: aspas JSX não escapadas e um listener que usava Hook em função com nome inválido para componente React.

### Sprint F — etiquetas

Entregar primeiro presets PIMACO usados pela loja, geração PDF em escala e teste físico registrado.

### Sprint G — venda comercial incremental

Completar apenas lacunas sobre o motor atual, mantendo DRAFT, cálculo canônico e autorizações.

### Sprint H — PDV e comprovantes

Refinar scanner/atalhos, fechamento por forma, cupom comercial, política de troca e integração fiscal desacoplada.

### Sprint I — retorno canônico

Consolidar modelos e garantir retorno parcial, troca, carteira, estoque, financeiro e comissão uma única vez.

### Sprint J — financeiro base consolidado

Formalizar obrigações e eventos de baixa, incluindo parcial, estorno, juros/descontos e transferências.

### Sprint K — fluxo, DRE, recorrência e conciliação

Entregar previsto/realizado, DRE explicável, recorrência e conciliação OFX manual. Open Finance é extensão.

### Sprint L — relatórios

Unificar definições, filtros, exportação e catálogo de vendas, estoque e cadastros.

### Sprint M — fiscal em homologação

Depende de provedor, emitente, UF, regime, certificado e escopo documental definidos. Não habilitar produção automaticamente.

### Sprint N — validação e ensaio de migração

Executar em ambiente separado com dados sanitizados, reconciliação, rerun e critérios de go/no-go.

## 6. Critérios transversais

- Toda ação valida tenant e permissão no servidor.
- Dinheiro usa `Decimal`; o servidor recalcula valores comerciais.
- Operações repetidas são idempotentes.
- Mudança cadastral não altera snapshots históricos.
- Relatórios e exportações usam as mesmas definições e permissões.
- Nenhum sucesso simulado em rota produtiva.
- Migrações são aditivas; sem reset/drop de produção.
- Nenhuma emissão fiscal, baixa real, publicação ou migração de produção faz parte de testes comuns.

## 7. Próximo passo

Sprint A concluída no escopo seguro: `Company` permanece mestre cadastral; `OperationalSettings` é a fonte operacional; usuário e grupo mantêm precedência explícita para descontos. Campos legados não foram removidos e só participam da criação inicial da configuração canônica, sem escrita dupla. O estoque negativo de ajuste manual continua sendo política distinta.

Pendências deliberadas:

- Sprint E: concluir formulários operacionais, extrato histórico reconciliado e validação autenticada no navegador; o núcleo persistente já está homologado.
- Sprints G–H: numeração comercial atômica, conclusão sem pagamento, apresentação do PDV e comprovantes, conectadas ao motor real de vendas.
- Sprint M: certificado, CSC/token, série, ambiente e demais configurações fiscais após escolha do provedor e homologação.
- Sprints I–K: executar as decisões registradas em `docs/decisions/ADR_RETURN_DOMAIN.md` e `docs/decisions/ADR_FINANCIAL_SOURCE_OF_TRUTH.md`.
