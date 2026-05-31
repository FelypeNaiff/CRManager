/**
 * financial-adapter.ts
 * Adapter de compatibilidade temporária: espelha operações do PostgreSQL para o Firebase Firestore.
 * Garante que telas que ainda usam Firestore continuem funcionando durante a migração.
 */

import { prisma } from '@/lib/prisma';

// Importação dinâmica do Firebase para evitar erros em ambientes sem acesso
async function getFirestoreDb() {
  try {
    const { getFirestore } = await import('firebase/firestore');
    const { initializeApp, getApps } = await import('firebase/app');
    const { firebaseConfig } = await import('../../firebase/config');
    
    let app = getApps()[0];
    if (!app) {
      app = initializeApp(firebaseConfig);
    }
    return getFirestore(app);
  } catch {
    return null;
  }
}

/**
 * Sincroniza uma conta bancária do PostgreSQL para o Firestore.
 */
export async function syncBankAccountToFirestore(bankAccountId: string): Promise<void> {
  try {
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });
    if (!account) return;

    const db = await getFirestoreDb();
    if (!db) return;

    const { doc, setDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'bank_accounts', account.legacyFirebaseId || bankAccountId);

    await setDoc(docRef, {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      currentBalance: Number(account.currentBalance),
      initialBalance: Number(account.initialBalance),
      isCashAccount: account.isCashAccount,
      status: account.isActive ? 'ACTIVE' : 'INACTIVE',
      updatedAt: account.updatedAt.toISOString(),
      _syncedFromPostgres: true,
      _postgresId: account.id,
    }, { merge: true });

    console.log(`[Financial Adapter] Synced bank account "${account.name}" to Firestore.`);
  } catch (error) {
    console.error('[Financial Adapter] Failed to sync bank account to Firestore:', error);
  }
}

/**
 * Sincroniza uma transação financeira do PostgreSQL para o Firestore (accounts_receivable).
 */
export async function syncReceivableToFirestore(receivableId: string): Promise<void> {
  try {
    const receivable = await prisma.accountsReceivable.findUnique({
      where: { id: receivableId },
      include: { customer: { select: { name: true, phone: true } } },
    });
    if (!receivable) return;

    const db = await getFirestoreDb();
    if (!db) return;

    const { doc, setDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'accounts_receivable', receivable.legacyFirebaseId || receivableId);

    await setDoc(docRef, {
      id: receivable.id,
      customerId: receivable.customerId,
      customerName: receivable.customer?.name,
      installmentNumber: receivable.installmentNumber,
      totalInstallments: receivable.totalInstallments,
      originalAmount: Number(receivable.originalAmount),
      paidAmount: Number(receivable.paidAmount),
      remainingAmount: Number(receivable.remainingAmount),
      dueDate: receivable.dueDate.toISOString().split('T')[0],
      paidAt: receivable.paidAt?.toISOString() || null,
      status: receivable.status,
      _syncedFromPostgres: true,
      _postgresId: receivable.id,
    }, { merge: true });

    console.log(`[Financial Adapter] Synced receivable ${receivableId} to Firestore.`);
  } catch (error) {
    console.error('[Financial Adapter] Failed to sync receivable to Firestore:', error);
  }
}
