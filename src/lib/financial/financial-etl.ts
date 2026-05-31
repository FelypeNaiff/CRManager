import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase/config';
import { prisma } from '../prisma';

export interface FinancialEtlReport {
  bankAccounts: { read: number; migrated: number; errors: number };
  paymentMethods: { read: number; migrated: number; errors: number };
  financialAccounts: { read: number; migrated: number; errors: number };
  receivables: { read: number; migrated: number; errors: number };
  cashRegisters: { read: number; migrated: number; errors: number };
  logs: string[];
}

export async function runFinancialEtl(targetCompanyId: string = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9'): Promise<FinancialEtlReport> {
  const report: FinancialEtlReport = {
    bankAccounts: { read: 0, migrated: 0, errors: 0 },
    paymentMethods: { read: 0, migrated: 0, errors: 0 },
    financialAccounts: { read: 0, migrated: 0, errors: 0 },
    receivables: { read: 0, migrated: 0, errors: 0 },
    cashRegisters: { read: 0, migrated: 0, errors: 0 },
    logs: [],
  };

  const addLog = (msg: string) => {
    console.log(`[ETL Financial] ${msg}`);
    report.logs.push(`${new Date().toISOString().substring(11, 19)}: ${msg}`);
  };

  addLog('Starting Financial ETL Pipeline...');

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app, 'crmanager');
    addLog('Firebase SDK connected to database: crmanager');

    // Mapeamentos para relacionamentos
    const firestoreBankMap: Record<string, string> = {};
    
    // Pegar o usuario default pra associar caixas
    const defaultUser = await prisma.user.findFirst({ where: { companyId: targetCompanyId } });
    const defaultUserId = defaultUser?.id;

    // 1. Contas Bancárias (contas_bancarias)
    addLog('Migrating bank accounts...');
    const bankSnap = await getDocs(collection(db, 'contas_bancarias'));
    report.bankAccounts.read = bankSnap.size;
    for (const doc of bankSnap.docs) {
      const data = doc.data();
      try {
        const bank = await prisma.bankAccount.create({
          data: {
            companyId: targetCompanyId,
            name: data.nome || data.name || 'Conta Padrão',
            bankName: data.banco || data.bankName || null,
            accountNumber: data.conta || data.accountNumber || null,
            agency: data.agencia || data.agency || null,
            initialBalance: data.saldo_inicial || 0,
            currentBalance: data.saldo_atual || data.saldo || 0,
            isCashAccount: data.is_cash === true || false,
            legacyFirebaseId: doc.id
          }
        });
        firestoreBankMap[doc.id] = bank.id;
        report.bankAccounts.migrated++;
      } catch (e: any) {
        report.bankAccounts.errors++;
        addLog(`Error bank ${doc.id}: ${e.message}`);
      }
    }

    // 2. Formas de Pagamento (formas_pagamento)
    addLog('Migrating payment methods...');
    const paySnap = await getDocs(collection(db, 'formas_pagamento'));
    report.paymentMethods.read = paySnap.size;
    for (const doc of paySnap.docs) {
      const data = doc.data();
      try {
        await prisma.paymentMethod.create({
          data: {
            companyId: targetCompanyId,
            name: data.nome || 'Forma Pagamento',
            type: data.tipo === 'PIX' ? 'PIX' : (data.tipo === 'DINHEIRO' ? 'CASH' : 'OTHER'),
            allowsInstallments: data.permite_parcelamento || false,
            feePercentage: data.taxa || 0,
            legacyFirebaseId: doc.id
          }
        });
        report.paymentMethods.migrated++;
      } catch (e: any) {
        report.paymentMethods.errors++;
        addLog(`Error payment method ${doc.id}: ${e.message}`);
      }
    }

    // 3. Plano de Contas (categorias_financeiras)
    addLog('Migrating financial accounts...');
    const catSnap = await getDocs(collection(db, 'categorias_financeiras'));
    report.financialAccounts.read = catSnap.size;
    for (const doc of catSnap.docs) {
      const data = doc.data();
      try {
        await prisma.financialAccount.create({
          data: {
            companyId: targetCompanyId,
            code: data.codigo || doc.id.substring(0, 6),
            name: data.nome || 'Categoria',
            type: data.tipo === 'RECEITA' || data.tipo === 'INCOME' ? 'INCOME' : 'EXPENSE',
            legacyFirebaseId: doc.id
          }
        });
        report.financialAccounts.migrated++;
      } catch (e: any) {
        report.financialAccounts.errors++;
        addLog(`Error financial account ${doc.id}: ${e.message}`);
      }
    }

    // 4. Contas a Receber (contas_receber)
    addLog('Migrating accounts receivable...');
    const recSnap = await getDocs(collection(db, 'contas_receber'));
    report.receivables.read = recSnap.size;
    for (const doc of recSnap.docs) {
      const data = doc.data();
      try {
        await prisma.accountsReceivable.create({
          data: {
            companyId: targetCompanyId,
            originalAmount: data.valor_original || data.valor || 0,
            remainingAmount: data.valor_restante || data.valor || 0,
            dueDate: data.data_vencimento?.toMillis ? new Date(data.data_vencimento.toMillis()) : new Date(),
            status: data.status === 'PAGO' ? 'PAID' : 'PENDING',
            legacyFirebaseId: doc.id
          }
        });
        report.receivables.migrated++;
      } catch (e: any) {
        report.receivables.errors++;
      }
    }

    // 5. Caixas (caixas)
    addLog('Migrating cash registers...');
    const cashSnap = await getDocs(collection(db, 'caixas'));
    report.cashRegisters.read = cashSnap.size;
    for (const doc of cashSnap.docs) {
      const data = doc.data();
      
      // Procura uma conta default
      const defaultBank = await prisma.bankAccount.findFirst({ where: { companyId: targetCompanyId } });
      const bankId = defaultBank?.id;
      
      if (!defaultUserId || !bankId) {
         report.cashRegisters.errors++;
         continue;
      }
      
      try {
        await prisma.cashRegister.create({
          data: {
            companyId: targetCompanyId,
            openedByUserId: defaultUserId,
            bankAccountId: bankId,
            openingBalance: data.saldo_abertura || 0,
            status: data.status === 'FECHADO' ? 'CLOSED' : 'OPEN',
            openedAt: data.data_abertura?.toMillis ? new Date(data.data_abertura.toMillis()) : new Date(),
          }
        });
        report.cashRegisters.migrated++;
      } catch (e: any) {
        report.cashRegisters.errors++;
      }
    }

    addLog('Financial ETL Pipeline completed successfully.');
  } catch (error: any) {
    addLog(`FATAL ERROR DURING ETL PIPELINE: ${error.message}`);
  }

  return report;
}
