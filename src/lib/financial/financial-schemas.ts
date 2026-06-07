import { z } from 'zod';

// ─── Bank Account ─────────────────────────────────────────────────────────────

export const BankAccountSchema = z.object({
  name: z.string().min(1, 'Nãome é obrigatório').max(100),
  bankName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  agency: z.string().max(20).optional().nullable(),
  pixKey: z.string().max(150).optional().nullable(),
  initialBalance: z.number().default(0),
  isCashAccount: z.boolean().default(false),
});

export type BankAccountInput = z.infer<typeof BankAccountSchema>;

// ─── Cost Center ──────────────────────────────────────────────────────────────

export const CostCenterSchema = z.object({
  name: z.string().min(1, 'Nãome é obrigatório').max(100),
  code: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export type CostCenterInput = z.infer<typeof CostCenterSchema>;

// ─── Financial Account (Plano de Contas) ─────────────────────────────────────

export const FinancialAccountSchema = z.object({
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().min(1, 'Código é obrigatório').max(20),
  name: z.string().min(1, 'Nãome é obrigatório').max(100),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: 'Tipo é obrigatório' }),
  acceptsEntries: z.boolean().default(true),
});

export type FinancialAccountInput = z.infer<typeof FinancialAccountSchema>;

// ─── Payment Method ───────────────────────────────────────────────────────────

export const PaymentMethodSchema = z.object({
  name: z.string().min(1, 'Nãome é obrigatório').max(100),
  type: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'STORE_CREDIT', 'CHECK', 'OTHER']),
  allowsInstallments: z.boolean().default(false),
  autoReceive: z.boolean().default(false),
  requiresAuthorization: z.boolean().default(false),
  feePercentage: z.number().min(0).max(100).default(0),
  settlementDays: z.number().int().min(0).default(0),
});

export type PaymentMethodInput = z.infer<typeof PaymentMethodSchema>;

// ─── Cash Register ────────────────────────────────────────────────────────────

export const CashRegisterOpenSchema = z.object({
  bankAccountId: z.string().uuid('ID de conta bancária inválido'),
  openingBalance: z.number().min(0, 'Saldo inicial deve ser positivo').default(0),
  terminalId: z.string().max(50).optional().nullable(),
  deviceId: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const CashRegisterCloseSchema = z.object({
  closingBalance: z.number().min(0, 'Saldo de fechamento deve ser positivo'),
  notes: z.string().max(500).optional().nullable(),
});

export const CashMovementSchema = z.object({
  cashRegisterId: z.string().uuid('ID de caixa inválido'),
  type: z.enum(['REFORCO', 'SANGRIA', 'AJUSTE']),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().max(500).optional().nullable(),
});

export type CashRegisterOpenInput = z.infer<typeof CashRegisterOpenSchema>;
export type CashRegisterCloseInput = z.infer<typeof CashRegisterCloseSchema>;
export type CashMovementInput = z.infer<typeof CashMovementSchema>;

// ─── Financial Transaction ────────────────────────────────────────────────────

export const FinancialTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'CASH_IN', 'CASH_OUT']),
  direction: z.enum(['IN', 'OUT']),
  bankAccountId: z.string().uuid().optional().nullable(),
  cashRegisterId: z.string().uuid().optional().nullable(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  financialAccountId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  referenceType: z.string().max(50).optional().nullable(),
  referenceId: z.string().max(100).optional().nullable(),
  sourceModule: z.string().max(50).optional().nullable(),
  externalReference: z.string().max(150).optional().nullable(),
  description: z.string().min(1, 'Descrição é obrigatória').max(500),
  amount: z.number().positive('Valor deve ser positivo'),
  dueDate: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export type FinancialTransactionInput = z.infer<typeof FinancialTransactionSchema>;

// ─── Accounts Receivable ──────────────────────────────────────────────────────

export const AccountsReceivableSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  financialAccountId: z.string().uuid().optional().nullable(),
  totalAmount: z.number().positive('Valor total deve ser positivo'),
  totalInstallments: z.number().int().min(1).max(60).default(1),
  dueDate: z.string({ required_error: 'Data de vencimento é obrigatória' }),
  description: z.string().min(1, 'Descrição é obrigatória').max(500),
  notes: z.string().max(500).optional().nullable(),
});

export const PayInstallmentSchema = z.object({
  amount: z.number().positive('Valor do pagamento deve ser positivo'),
  paidAt: z.string().optional().nullable(),
});

export type AccountsReceivableInput = z.infer<typeof AccountsReceivableSchema>;
export type PayInstallmentInput = z.infer<typeof PayInstallmentSchema>;
