import { collection, writeBatch, doc, getDocs, query, limit } from 'firebase/firestore';

export const DEFAULT_PAYMENT_METHODS = [
  { name: 'Dinheiro', feePercentage: 0, feeFixed: 0, receiptDays: 0, isSystem: true, status: 'ACTIVE' },
  { name: 'Pix', feePercentage: 0, feeFixed: 0, receiptDays: 0, isSystem: true, status: 'ACTIVE' },
  { name: 'Cartão de Crédito', feePercentage: 2.99, feeFixed: 0, receiptDays: 30, isSystem: true, status: 'ACTIVE' },
  { name: 'Cartão de Débito', feePercentage: 1.99, feeFixed: 0, receiptDays: 1, isSystem: true, status: 'ACTIVE' },
  { name: 'Boleto', feePercentage: 0, feeFixed: 3.50, receiptDays: 3, isSystem: true, status: 'ACTIVE' },
];

export const DEFAULT_CHART_OF_ACCOUNTS = [
  // RECEITAS
  { code: '1', name: 'Receitas', type: 'REVENUE', parentId: null, isSystem: true, status: 'ACTIVE' },
  { code: '1.1', name: 'Vendas de Produtos', type: 'REVENUE', parentId: '1', isSystem: true, status: 'ACTIVE' },
  { code: '1.2', name: 'Prestação de Serviços', type: 'REVENUE', parentId: '1', isSystem: true, status: 'ACTIVE' },
  { code: '1.3', name: 'Rendimentos de Investimentos', type: 'REVENUE', parentId: '1', isSystem: true, status: 'ACTIVE' },
  
  // DESPESAS
  { code: '2', name: 'Despesas', type: 'EXPENSE', parentId: null, isSystem: true, status: 'ACTIVE' },
  { code: '2.1', name: 'Despesas Fixas', type: 'EXPENSE', parentId: '2', isSystem: true, status: 'ACTIVE' },
  { code: '2.1.1', name: 'Aluguel e Condomínio', type: 'EXPENSE', parentId: '2.1', isSystem: true, status: 'ACTIVE' },
  { code: '2.1.2', name: 'Água, Luz e Internet', type: 'EXPENSE', parentId: '2.1', isSystem: true, status: 'ACTIVE' },
  { code: '2.1.3', name: 'Salários e Encargos', type: 'EXPENSE', parentId: '2.1', isSystem: true, status: 'ACTIVE' },
  { code: '2.2', name: 'Despesas Variáveis', type: 'EXPENSE', parentId: '2', isSystem: true, status: 'ACTIVE' },
  { code: '2.2.1', name: 'Compra de Mercadorias (Estoque)', type: 'EXPENSE', parentId: '2.2', isSystem: true, status: 'ACTIVE' },
  { code: '2.2.2', name: 'Impostos sobre Vendas', type: 'EXPENSE', parentId: '2.2', isSystem: true, status: 'ACTIVE' },
  { code: '2.2.3', name: 'Comissões', type: 'EXPENSE', parentId: '2.2', isSystem: true, status: 'ACTIVE' },
  { code: '2.2.4', name: 'Marketing e Publicidade', type: 'EXPENSE', parentId: '2.2', isSystem: true, status: 'ACTIVE' },
];

export const DEFAULT_BANK_ACCOUNTS = [
  { name: 'Caixa Interno (Dinheiro)', type: 'CASH', initialBalance: 0, currentBalance: 0, status: 'ACTIVE', isSystem: true },
];

/**
 * Função para popular as tabelas financeiras com dados iniciais (Plano de contas, métodos de pagamento, etc)
 * O parâmetro empresaId é opcional, dependendo de como o multitenant for implementado na camada de gravação.
 */
export async function seedFinanceiroBasico(db: any, empresaId?: string) {
  try {
    const batch = writeBatch(db);

    // 1. Validar se já existe plano de contas
    const chartRef = collection(db, 'chart_of_accounts');
    const chartSnap = await getDocs(query(chartRef, limit(1)));
    
    if (chartSnap.empty) {
      // Seed Chart of Accounts
      const parentMap = new Map<string, string>(); // code -> firestore id
      
      for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
        const docRef = doc(chartRef);
        // Se for filho, encontra o ID do pai baseado no código parentId mapeado
        let mappedParentId = null;
        if (account.parentId) {
          mappedParentId = parentMap.get(account.parentId) || null;
        }

        const dataToSave = {
          ...account,
          parentId: mappedParentId,
          empresaId: empresaId || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        batch.set(docRef, dataToSave);
        parentMap.set(account.code, docRef.id);
      }
    }

    // 2. Validar métodos de pagamento
    const paymentRef = collection(db, 'payment_methods');
    const paymentSnap = await getDocs(query(paymentRef, limit(1)));
    if (paymentSnap.empty) {
      for (const pm of DEFAULT_PAYMENT_METHODS) {
        const docRef = doc(paymentRef);
        batch.set(docRef, {
          ...pm,
          empresaId: empresaId || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // 3. Validar conta bancária padrão (Caixa Dinheiro)
    const bankRef = collection(db, 'bank_accounts');
    const bankSnap = await getDocs(query(bankRef, limit(1)));
    if (bankSnap.empty) {
      for (const bank of DEFAULT_BANK_ACCOUNTS) {
        const docRef = doc(bankRef);
        batch.set(docRef, {
          ...bank,
          empresaId: empresaId || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // Executa as inserções em batch
    await batch.commit();
    console.log('Seed financeiro executado com sucesso!');
    return true;

  } catch (error) {
    console.error('Erro ao executar seed financeiro:', error);
    return false;
  }
}
