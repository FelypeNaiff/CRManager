# ADR: domínio canônico de retornos

- Status: aceito para direcionamento; migração pendente da Sprint I
- Data: 01/10/2026

## Contexto

O projeto possui três agregados sobrepostos: `ExchangeReturn`, `SaleExchange` e `SaleReturn`. Todos se relacionam com venda, itens, estoque, carteira, comissão e, potencialmente, financeiro. Evoluí-los em paralelo cria risco de devolver o mesmo item ou gerar efeitos financeiros duas vezes.

## Decisão

`ExchangeReturn` será o agregado canônico do processo de pós-venda, com itens e eventos explícitos para devolução, troca e seus efeitos. `SaleExchange` e `SaleReturn` permanecem compatíveis até uma migração aditiva e reconciliada; não receberão novos fluxos.

Toda operação deverá partir da venda original, respeitar a quantidade líquida ainda retornável e registrar estoque, carteira, comissão e financeiro na mesma transação ou por eventos idempotentes. A interface não poderá gravar diretamente em mais de um agregado.

## Consequências

- Sprint I deve mapear e reconciliar dados existentes antes de redirecionar leituras.
- Nenhuma tabela será removida nesta sprint.
- Relatórios antigos usarão adaptadores temporários, com telemetria para retirada posterior.
- O crédito já consumido nunca poderá ser apagado por cancelamento de retorno.

