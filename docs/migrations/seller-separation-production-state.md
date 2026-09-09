# Estado da separação User/Seller em produção

## Registro do inventário

- Data do inventário: 9 de setembro de 2026.
- Método: consultas agregadas e de catálogo em transação PostgreSQL explicitamente read-only, encerrada com rollback.
- Migration `20260605153000_separate_sellers`: aplicada.
- Migration `20260605195602_performance_02_indexes`: aplicada.
- Classificação estrutural observada: `NEW`.

Este registro não contém credenciais, identificadores de registros, dados pessoais ou referências do projeto de infraestrutura.

## Modelo observado

O banco separa identidade/autorização e operação comercial:

- `User` representa a identidade interna, o acesso e o papel de autorização.
- `Seller` é a entidade comercial canônica e independente.
- `sales.seller_id` referencia `sellers.id`.
- `seller_goals.seller_id` referencia `sellers.id`.
- `seller_commissions.seller_id` referencia `sellers.id`.
- `users` não possui mais `is_seller`, `seller_code` ou `commission_rate`.

O inventário encontrou zero referências órfãs e zero inconsistências cross-tenant nas relações avaliadas. Não foi observada inconsistência estrutural que justifique uma migration corretiva neste momento.

## Limite da evidência histórica

O estado atual não permite determinar se algum `seller_code` ou outro dado comercial antigo foi perdido durante a transição. Essa investigação exige um backup anterior a 5 de junho de 2026, restaurado em ambiente isolado e comparado em modo read-only.

A ausência atual de órfãos comprova a consistência referencial observada, mas não comprova por si só a preservação integral de todos os dados anteriores à migration.

## Regra de manutenção

**Não editar, reexecutar, substituir nem tentar corrigir retroativamente migrations históricas já aplicadas.** Isso alteraria o histórico e o checksum esperado, além de criar comportamentos diferentes entre ambientes.

Se uma perda ou inconsistência histórica for comprovada no futuro, a recuperação deverá ser implementada por uma nova migration ou por um procedimento corretivo separado, revisável, auditável, testado previamente em backup restaurado e autorizado explicitamente antes de qualquer execução.

