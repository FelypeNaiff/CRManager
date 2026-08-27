const SAFE_BUSINESS_MESSAGES = [
  /^Saldo insuficiente/i,
  /não encontrad[oa]/i,
  /operação não permitida/i,
  /não pode ser/i,
  /inválid[oa]/i,
  /já existe/i,
  /é obrigatório/i,
  /deve /i,
];

export function publicActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && SAFE_BUSINESS_MESSAGES.some(pattern => pattern.test(error.message))) {
    return error.message;
  }
  return fallback;
}
