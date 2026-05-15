export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type PayableReceivableStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED';
export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'RECONCILED' | 'CANCELLED';

// bank_accounts
export interface BankAccount {
  id?: string;
  name: string;
  type: BankAccountType;
  initialBalance: number;
  currentBalance: number;
  bankName?: string;
  agency?: string;
  accountNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  empresaId?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
}

// payment_methods
export interface PaymentMethod {
  id?: string;
  name: string; // Ex: Pix, Dinheiro, Cartão de Crédito, Cartão de Débito, Boleto
  feePercentage: number;
  feeFixed: number;
  receiptDays: number; // Quantos dias para o dinheiro cair na conta
  isSystem: boolean; // Se é do sistema ou criado pelo usuário
  status: 'ACTIVE' | 'INACTIVE';
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}

// chart_of_accounts (Plano de Contas / Categorias Financeiras)
export interface ChartOfAccount {
  id?: string;
  code: string; // Ex: "1", "1.1", "2.1.3"
  name: string;
  type: 'REVENUE' | 'EXPENSE';
  parentId: string | null;
  isSystem: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}

// cost_centers (Centros de Custo)
export interface CostCenter {
  id?: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}

// accounts_payable (Contas a Pagar)
export interface AccountPayable {
  id?: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD
  status: PayableReceivableStatus;
  
  supplierId?: string;
  supplierName?: string;
  
  chartOfAccountId?: string;
  costCenterId?: string;
  paymentMethodId?: string;
  bankAccountId?: string; // Se já foi paga, de onde saiu o dinheiro
  
  documentNumber?: string;
  notes?: string;
  recurrenceId?: string; // Se for despesa recorrente
  
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}

// accounts_receivable (Contas a Receber)
export interface AccountReceivable {
  id?: string;
  description: string;
  amount: number;
  receivedAmount: number;
  dueDate: string; // YYYY-MM-DD
  receiptDate?: string; // YYYY-MM-DD
  status: PayableReceivableStatus;
  
  clientId?: string;
  clientName?: string;
  saleId?: string; // Vinculo com o PDV
  
  chartOfAccountId?: string;
  costCenterId?: string;
  paymentMethodId?: string;
  bankAccountId?: string; // Se já foi recebida, para onde foi o dinheiro
  
  documentNumber?: string;
  notes?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}

// financial_transactions (Lançamentos Reais no Banco/Caixa)
export interface FinancialTransaction {
  id?: string;
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  status: TransactionStatus;
  
  bankAccountId: string; // De onde saiu ou entrou
  destinationBankAccountId?: string; // Apenas para TRANSFER
  
  chartOfAccountId?: string;
  costCenterId?: string;
  paymentMethodId?: string;
  
  referenceType?: 'PAYABLE' | 'RECEIVABLE' | 'SALE' | 'MANUAL';
  referenceId?: string; // ID da conta a pagar/receber ou venda vinculada
  
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}

// cash_registers (Caixas PDV)
export interface CashRegister {
  id?: string;
  userId: string;
  userName: string;
  openedAt: any; // Firestore Timestamp
  closedAt?: any;
  initialBalance: number;
  currentBalance: number;
  finalBalance?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  
  empresaId?: string;
  createdAt: any;
  updatedAt: any;
}
