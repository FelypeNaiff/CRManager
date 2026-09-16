const FORBIDDEN_AUDIT_KEY = /(pin|hash|password|senha|token|secret|api.?key|cpf|cnpj|phone|telefone|email|bank|banco|agencia|conta)/i;

export function sanitizeAuditForDisplay(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditForDisplay);
  if (typeof value !== 'object') return String(value);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !FORBIDDEN_AUDIT_KEY.test(key))
      .map(([key, item]) => [key, sanitizeAuditForDisplay(item)]),
  );
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  SALE_CREATE: 'Venda registrada', SALE_CANCEL: 'Venda cancelada',
  USER_ROLE_CHANGE: 'Grupo de acesso alterado', USER_ACCESS_PIN_RESET: 'PIN de acesso redefinido',
  CUSTOMER_UPDATE: 'Cliente atualizado', CASH_REGISTER_OPEN: 'Caixa aberto', CASH_REGISTER_CLOSE: 'Caixa fechado',
  PRODUCT_CREATE: 'Produto criado', PRODUCT_UPDATE: 'Produto atualizado',
  EXCHANGE_CREATE: 'Troca registrada', RETURN_CREATE: 'Devolução registrada',
  COMPANY_UPDATE: 'Dados da empresa atualizados', OPERATIONAL_SETTINGS_UPDATE: 'Configurações operacionais atualizadas',
  SALE_DISCOUNT_AUTHORIZED: 'Desconto autorizado', RECEIVABLE_PAYMENT: 'Conta a receber baixada',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/^./, c => c.toUpperCase());
}
