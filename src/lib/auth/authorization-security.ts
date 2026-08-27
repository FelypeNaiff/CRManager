import { AuthorizationStatus, AuthorizationType, Prisma } from '@prisma/client';

const AUTHORIZATION_MODULE: Record<AuthorizationType, string> = {
  DISCOUNT: 'PDV', SALE_CANCEL: 'VENDAS', SALE_REOPEN: 'VENDAS',
  EXCHANGE: 'TROCAS', EXCHANGE_CANCEL: 'TROCAS', RETURN: 'DEVOLUCOES',
  RETURN_CANCEL: 'DEVOLUCOES', WALLET_CREDIT: 'CARTEIRA', WALLET_DEBIT: 'CARTEIRA',
  WALLET_ADJUST: 'CARTEIRA', CASH_WITHDRAWAL: 'CAIXA', CASH_SUPPLY: 'CAIXA',
  CASH_DIFFERENCE: 'CAIXA', CASH_REOPEN: 'CAIXA', STOCK_ADJUST: 'ESTOQUE',
  NEGATIVE_STOCK: 'ESTOQUE', USER_PIN_RESET: 'USUARIOS', SETTINGS_UPDATE: 'CONFIGURACOES',
};

export function canonicalAuthorizationModule(type: AuthorizationType): string {
  return AUTHORIZATION_MODULE[type];
}

export function approvedAuthorizationWhere(input: {
  id: string; companyId: string; type: AuthorizationType; module: string;
  referenceId?: string; referenceModule?: string;
}): Prisma.ActionAuthorizationWhereInput {
  return {
    id: input.id,
    companyId: input.companyId,
    status: AuthorizationStatus.APPROVED,
    type: input.type,
    module: input.module,
    ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
    ...(input.referenceModule === undefined ? {} : { referenceModule: input.referenceModule }),
  };
}

export function authorizationBelongsToTenant(id: string, companyId: string) {
  return { id, companyId };
}
