# Estratégia de conexão PostgreSQL/Supabase

## Matriz oficial

| Componente | Variável | Conexão | Sessão persistente | Regra |
|---|---|---|---:|---|
| Runtime Next.js/Vercel | `DATABASE_URL` | Transaction Pooler, porta 6543 | Não | Usar `pgbouncer=true`, iniciar com `connection_limit=1` e exigir SSL |
| Prisma CLI e migrations | `DIRECT_URL` | Direct Connection preferencial; Session Pooler como alternativa IPv4 | Sim | Nunca usar Transaction Pooler para DDL/migrations |
| Desenvolvimento local | As duas, conforme finalidade | Runtime pooled; CLI direct/session | Depende | Não misturar os alvos |
| Scripts administrativos | `ADMIN_DATABASE_URL` | Alvo administrativo explícito | Depende | Nunca fazer fallback para `DATABASE_URL` |
| Testes isolados | Nenhuma | Sem banco | Não | Remover `DATABASE_URL` e `DIRECT_URL` do processo de teste |

O Prisma Client de runtime lê `DATABASE_URL`. No schema atual, `DIRECT_URL` é destinada às operações do Prisma CLI que exigem conexão compatível com sessão. A configuração efetiva dos secrets da Vercel ainda não foi auditada, pois a CLI não estava disponível; nenhuma variável ou configuração da Vercel foi alterada.

O Transaction Pooler não oferece semântica tradicional de prepared statements. Com a versão atual do Prisma, `pgbouncer=true` é necessário. Em serverless, `connection_limit=1` é o ponto inicial conservador e deve ser revisto somente com métricas. `pool_timeout` não deve ser definido sem conhecer concorrência, limite do projeto e comportamento observado.

## Infraestrutura para scripts administrativos

`src/lib/database/admin-script-access.ts` fornece uma fronteira opt-in para migração futura dos scripts:

- exige `ADMIN_DATABASE_URL` e nunca consulta `DATABASE_URL`;
- exige identificação explícita do ambiente;
- exige confirmação literal para modo destrutivo;
- exige dois opt-ins independentes para produção destrutiva;
- oferece execução em transação com `SET TRANSACTION READ ONLY` e validação server-side;
- sanitiza URLs PostgreSQL e atribuições de senha em erros.

O helper é inerte ao ser importado. Nenhum script existente foi migrado nesta etapa e nenhum acesso ao banco é iniciado automaticamente.

## Inventário de scripts

### KEEP — 12

Operações locais sem acesso administrativo ao PostgreSQL:

- `fix-encoding.js`
- `fix-frontend-encoding.ts`
- `fix-remaining-encoding.ts`
- `generate-clean-test-sheets.ts`
- `generate-test-sheets.ts`
- `patch-actions.js`
- `patch-global.js`
- `run-safe-tests.mjs`
- `standardize-frontend.ts`
- `test-navigation-routes.ts`
- `test-supabase-password-login-flow.ts`
- `validate-backup.ps1`

### PROTECT — 22

Ainda podem ter finalidade operacional, mas devem adotar alvo administrativo explícito, proteção read-only ou confirmação destrutiva antes de serem executados:

- `audit-performance-01.ts`
- `audit-test-data.ts`
- `backup-db.ps1`
- `check-migrations.ts`
- `create-master-user.ts`
- `create-master.js`
- `diagnose-go-live.ts`
- `fix-db-encoding.ts`
- `get_payments.ts`
- `import-crm-data.ts`
- `import-financial-data.ts`
- `import-products-data.ts`
- `import-sellers-data.ts`
- `inspect-user.ts`
- `list-companies.ts`
- `make-admin.ts`
- `purge-test-data.ts`
- `resolve-test-ids.ts`
- `run-migration.ts`
- `sanitize-data.ts`
- `seed-test-user.ts`
- `validate-imports.ts`

`prisma/seed.ts` é um item adicional `PROTECT`: executa upserts e não deve herdar silenciosamente o alvo de runtime.

### RETIRE — 22

Scripts históricos, reparos diretos de schema, falsos testes ou fluxos com banco real que devem ser removidos ou substituídos em commits próprios:

- `add-columns-back.ts`
- `audit-crm-orto-base.ts`
- `audit.ts`
- `diagnostic.ts`
- `drop-columns.ts`
- `fix-migrations.ts`
- `recreate-columns.ts`
- `run-etl.ts`
- `run-financial-etl.ts`
- `run-products-etl.ts`
- `test-commercial-reports-flow.ts`
- `test-concurrency.ts`
- `test-crm-flow.ts`
- `test-crm.ts`
- `test-dashboard-load-flow.ts`
- `test-financial-audit.ts`
- `test-financial-flow.ts`
- `test-go-live-pilot-validation.ts`
- `test-login-production-flow.ts`
- `test-products-flow.ts`
- `test-sales-schema.ts`
- `truncate.ts`

Esta classificação não autoriza execução ou remoção. Cada grupo deve ser tratado em etapa própria, preservando scripts operacionais até existir substituição segura.
