# ADR: fonte de verdade financeira

- Status: aceito para direcionamento; consolidação pendente das Sprints J–K
- Data: 01/10/2026

## Contexto

Há modelos distintos para obrigação, recebível/pagável, movimento de caixa e transação financeira. Tratar qualquer um isoladamente como saldo definitivo produz divergências entre contas, caixa, DRE e conciliação.

## Decisão

`AccountsReceivable` e `AccountsPayable` representam obrigações. Baixas e estornos serão eventos financeiros explícitos e idempotentes. `FinancialTransaction` será o razão operacional de movimentos realizados e previstos; `CashMovement` continuará sendo o subdomínio físico do caixa/PDV, referenciado pelo evento financeiro correspondente.

Relatórios de saldo e fluxo serão derivados do razão, nunca de campos editáveis ou da soma direta de vendas. Venda, retorno e carteira originam obrigações/eventos por serviços canônicos, sem escrita paralela por telas.

## Consequências

- Sprint J deve criar vínculos e chaves de idempotência de forma aditiva.
- Sprint K implementará previsto/realizado, DRE e conciliação sobre o razão.
- Migração exige reconciliação por empresa e não poderá apagar modelos legados.
- Integrações fiscais e bancárias permanecem desacopladas do núcleo contábil.

