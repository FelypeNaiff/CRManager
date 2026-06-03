import { AuthorizationType, AuthorizationStatus } from '@prisma/client';
import { PermissionModule, PermissionAction } from './permission-catalog';

export { AuthorizationType, AuthorizationStatus };

// Map each AuthorizationType to its required RBAC Permission
export const AUTHORIZATION_PERMISSION_MAP: Record<AuthorizationType, { module: PermissionModule, action: PermissionAction }> = {
  [AuthorizationType.DISCOUNT]: { module: 'PDV', action: 'AUTHORIZE_DISCOUNT' },
  [AuthorizationType.SALE_CANCEL]: { module: 'VENDAS', action: 'CANCEL' },
  [AuthorizationType.SALE_REOPEN]: { module: 'VENDAS', action: 'UPDATE' },
  [AuthorizationType.EXCHANGE]: { module: 'TROCAS', action: 'AUTHORIZE' }, // or CREATE? Usually authorization uses AUTHORIZE action if exists
  [AuthorizationType.EXCHANGE_CANCEL]: { module: 'TROCAS', action: 'CANCEL' },
  [AuthorizationType.RETURN]: { module: 'DEVOLUCOES', action: 'AUTHORIZE' },
  [AuthorizationType.RETURN_CANCEL]: { module: 'DEVOLUCOES', action: 'CANCEL' },
  [AuthorizationType.WALLET_CREDIT]: { module: 'CARTEIRA', action: 'AUTHORIZE' },
  [AuthorizationType.WALLET_DEBIT]: { module: 'CARTEIRA', action: 'AUTHORIZE' },
  [AuthorizationType.WALLET_ADJUST]: { module: 'CARTEIRA', action: 'AUTHORIZE' },
  [AuthorizationType.CASH_WITHDRAWAL]: { module: 'CAIXA', action: 'CASH_WITHDRAWAL' },
  [AuthorizationType.CASH_SUPPLY]: { module: 'CAIXA', action: 'CASH_SUPPLY' },
  [AuthorizationType.CASH_DIFFERENCE]: { module: 'CAIXA', action: 'CLOSE' }, // Requires close with diff
  [AuthorizationType.CASH_REOPEN]: { module: 'CAIXA', action: 'UPDATE' },
  [AuthorizationType.STOCK_ADJUST]: { module: 'ESTOQUE', action: 'ADJUST' },
  [AuthorizationType.NEGATIVE_STOCK]: { module: 'ESTOQUE', action: 'ADJUST' },
  [AuthorizationType.USER_PIN_RESET]: { module: 'USUARIOS', action: 'RESET_PIN' },
  [AuthorizationType.SETTINGS_UPDATE]: { module: 'CONFIGURACOES', action: 'UPDATE' },
};
