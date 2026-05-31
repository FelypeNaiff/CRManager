import { initializeApp, getApps, initializeServerApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase/config';
import { prisma } from '../prisma';

export interface EtlReport {
  totalCustomers: { read: number; migrated: number; duplicated: number; errors: number };
  totalChildren: { read: number; migrated: number; errors: number };
  totalTags: { read: number; migrated: number; errors: number };
  totalWallets: { read: number; migrated: number; errors: number };
  totalMovements: { read: number; migrated: number; errors: number };
  totalHistory: { read: number; migrated: number; errors: number };
  logs: string[];
}

/**
 * Runs the ETL pipeline from Firestore crmanager to Supabase PostgreSQL.
 * Can be executed on the server via Server Action.
 */
export async function runCrmEtl(targetCompanyId: string = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9'): Promise<EtlReport> {
  const report: EtlReport = {
    totalCustomers: { read: 0, migrated: 0, duplicated: 0, errors: 0 },
    totalChildren: { read: 0, migrated: 0, errors: 0 },
    totalTags: { read: 0, migrated: 0, errors: 0 },
    totalWallets: { read: 0, migrated: 0, errors: 0 },
    totalMovements: { read: 0, migrated: 0, errors: 0 },
    totalHistory: { read: 0, migrated: 0, errors: 0 },
    logs: [],
  };

  const addLog = (msg: string) => {
    console.log(`[ETL] ${msg}`);
    report.logs.push(`${new Date().toISOString().substring(11, 19)}: ${msg}`);
  };

  addLog('Starting CRM ETL Pipeline...');

  try {
    // 1. Initialize Firebase client-side SDK on the server
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app, 'crmanager');
    addLog('Firebase SDK connected to database: crmanager');

    // Verify company exists
    const companyExists = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!companyExists) {
      throw new Error(`Target Company ID ${targetCompanyId} not found in database.`);
    }
    addLog(`Target company identified: ${companyExists.nomeFantasia}`);

    // Clean existing data mapping first (Optional but let's update/upsert to prevent duplicates)
    // We will upsert customers using legacyFirebaseId or skip duplicates.

    // ─── 2. MIGRATE TAGS ───
    addLog('Reading legacy tags...');
    const tagsSnap = await getDocs(collection(db, 'tags'));
    report.totalTags.read = tagsSnap.size;
    addLog(`Found ${tagsSnap.size} tags in Firestore.`);

    const firestoreTagMap: Record<string, string> = {}; // firebaseTagId -> postgresTagId

    for (const tagDoc of tagsSnap.docs) {
      const data = tagDoc.data();
      const tagName = data.nome || data.name || tagDoc.id;
      const tagColor = data.cor || data.color || '#64748b';

      try {
        const tag = await prisma.customerTag.upsert({
          where: {
            companyId_name: {
              companyId: targetCompanyId,
              name: tagName,
            },
          },
          update: {
            color: tagColor,
            legacyFirebaseId: tagDoc.id,
          },
          create: {
            companyId: targetCompanyId,
            name: tagName,
            color: tagColor,
            legacyFirebaseId: tagDoc.id,
          },
        });
        firestoreTagMap[tagDoc.id] = tag.id;
        report.totalTags.migrated++;
      } catch (err: any) {
        report.totalTags.errors++;
        addLog(`Error upserting tag "${tagName}": ${err.message}`);
      }
    }
    addLog(`Tags migrated: ${report.totalTags.migrated}/${report.totalTags.read}`);

    // ─── 3. MIGRATE CUSTOMERS ───
    addLog('Reading legacy customers (clientes)...');
    const customersSnap = await getDocs(collection(db, 'clientes'));
    report.totalCustomers.read = customersSnap.size;
    addLog(`Found ${customersSnap.size} customers in Firestore.`);

    const firestoreCustMap: Record<string, string> = {}; // firebaseCustId -> postgresCustId

    for (const custDoc of customersSnap.docs) {
      const data = custDoc.data();
      const rawName = data.nome || data.name || 'Sem Nome';
      const rawPhone = data.telefone || data.phone || '';
      
      // Clean phone number (keep only digits)
      let phone = rawPhone.replace(/\D/g, '');
      let phoneIsPlaceholder = false;
      let needsPhoneReview = false;

      if (!phone || phone.length < 8) {
        phone = `LEGACY-${custDoc.id}`;
        phoneIsPlaceholder = true;
        needsPhoneReview = true;
        addLog(`Phone missing/invalid for "${rawName}". Using placeholder: ${phone}`);
      }

      // Check unique constraint in target Postgres
      const phoneDuplicate = await prisma.customer.findFirst({
        where: {
          companyId: targetCompanyId,
          phone,
          legacyFirebaseId: { not: custDoc.id },
        },
      });

      if (phoneDuplicate) {
        report.totalCustomers.duplicated++;
        addLog(`Duplicate phone detected for "${rawName}" (${phone}) - Skipping.`);
        continue;
      }

      // Parse birthdate
      let birthDay: number | null = null;
      let birthMonth: number | null = null;
      let birthYear: number | null = null;

      if (data.data_nascimento) {
        try {
          const d = new Date(data.data_nascimento);
          if (!isNaN(d.getTime())) {
            birthDay = d.getDate();
            birthMonth = d.getMonth() + 1;
            birthYear = d.getFullYear() > 1900 ? d.getFullYear() : null;
          }
        } catch {}
      } else {
        if (data.diaNascimento) birthDay = Number(data.diaNascimento);
        if (data.mesNascimento) birthMonth = Number(data.mesNascimento);
      }

      try {
        const customer = await prisma.customer.upsert({
          where: { legacyFirebaseId: custDoc.id },
          update: {
            name: rawName,
            email: data.email || null,
            phone,
            cpf: data.cpf || null,
            birthDay,
            birthMonth,
            birthYear,
            instagram: data.instagram || null,
            notes: data.observacoes || data.notes || null,
            status: data.status === 'arquivado' || data.status === 'inativo' ? data.status : 'ativo',
            phoneIsPlaceholder,
            needsPhoneReview,
          },
          create: {
            companyId: targetCompanyId,
            name: rawName,
            email: data.email || null,
            phone,
            cpf: data.cpf || null,
            birthDay,
            birthMonth,
            birthYear,
            instagram: data.instagram || null,
            notes: data.observacoes || data.notes || null,
            status: data.status === 'arquivado' || data.status === 'inativo' ? data.status : 'ativo',
            phoneIsPlaceholder,
            needsPhoneReview,
            legacyFirebaseId: custDoc.id,
            wallet: {
              create: { balance: 0.0 },
            },
          },
        });

        firestoreCustMap[custDoc.id] = customer.id;
        report.totalCustomers.migrated++;
      } catch (err: any) {
        report.totalCustomers.errors++;
        addLog(`Error upserting customer "${rawName}" (ID: ${custDoc.id}): ${err.message}`);
      }
    }
    addLog(`Customers migrated: ${report.totalCustomers.migrated}/${report.totalCustomers.read} (Duplicated: ${report.totalCustomers.duplicated})`);

    // ─── 4. MIGRATE CHILDREN (FILHOS) ───
    addLog('Reading legacy children (filhos)...');
    const childrenSnap = await getDocs(collection(db, 'filhos'));
    report.totalChildren.read = childrenSnap.size;
    addLog(`Found ${childrenSnap.size} children in Firestore.`);

    for (const childDoc of childrenSnap.docs) {
      const data = childDoc.data();
      const rawParentId = data.cliente_id || data.clientId;
      const pgParentId = firestoreCustMap[rawParentId];

      if (!pgParentId) {
        report.totalChildren.errors++;
        addLog(`Skipped child "${data.nome}" (ID: ${childDoc.id}): Parent legacy ID ${rawParentId} not migrated.`);
        continue;
      }

      let birthDate: Date | null = null;
      if (data.data_nascimento) {
        try {
          const d = new Date(data.data_nascimento);
          if (!isNaN(d.getTime())) birthDate = d;
        } catch {}
      }

      try {
        await prisma.customerChild.create({
          data: {
            customerId: pgParentId,
            name: data.nome || 'Sem nome',
            birthDate,
            gender: data.sexo || null,
            shoeSize: data.tamanho_calcado || data.tamanhoCalcado || null,
            clothingSize: data.tamanho_roupa || data.tamanhoRoupa || null,
            notes: data.observacoes || data.notes || null,
            legacyFirebaseId: childDoc.id,
          },
        });
        report.totalChildren.migrated++;
      } catch (err: any) {
        report.totalChildren.errors++;
        addLog(`Error creating child "${data.nome}" (ID: ${childDoc.id}): ${err.message}`);
      }
    }
    addLog(`Children migrated: ${report.totalChildren.migrated}/${report.totalChildren.read}`);

    // ─── 5. MIGRATE CLIENT WALLETS & BALANCE ───
    addLog('Reading client wallets (carteiras_clientes)...');
    const walletSnap = await getDocs(collection(db, 'carteiras_clientes'));
    report.totalWallets.read = walletSnap.size;

    for (const walletDoc of walletSnap.docs) {
      const data = walletDoc.data();
      const rawParentId = data.cliente_id || data.clientId;
      const pgParentId = firestoreCustMap[rawParentId];

      if (!pgParentId) {
        report.totalWallets.errors++;
        continue;
      }

      const balance = Number(data.saldo_atual || data.saldo || 0);

      try {
        await prisma.customerWallet.upsert({
          where: { customerId: pgParentId },
          update: { balance },
          create: { customerId: pgParentId, balance },
        });
        report.totalWallets.migrated++;
      } catch (err: any) {
        report.totalWallets.errors++;
        addLog(`Error syncing wallet balance for legacy client ID ${rawParentId}: ${err.message}`);
      }
    }
    addLog(`Wallets updated: ${report.totalWallets.migrated}/${report.totalWallets.read}`);

    // ─── 6. CLIENT WALLET MOVEMENTS ───
    addLog('Reading balance history (movimentacoes_saldo)...');
    const movementsSnap = await getDocs(collection(db, 'movimentacoes_saldo'));
    report.totalMovements.read = movementsSnap.size;

    for (const movDoc of movementsSnap.docs) {
      const data = movDoc.data();
      const rawParentId = data.cliente_id || data.clientId;
      const pgParentId = firestoreCustMap[rawParentId];

      if (!pgParentId) {
        report.totalMovements.errors++;
        continue;
      }

      try {
        const wallet = await prisma.customerWallet.findUnique({ where: { customerId: pgParentId } });
        if (!wallet) continue;

        await prisma.customerWalletMovement.create({
          data: {
            walletId: wallet.id,
            amount: Number(data.valor_movimentado || data.valor || 0),
            type: data.tipo_movimentacao || data.tipo || 'credit',
            reason: data.motivo || data.descricao || null,
            legacyFirebaseId: movDoc.id,
            createdAt: data.created_at?.toMillis ? new Date(data.created_at.toMillis()) : new Date(),
          },
        });
        report.totalMovements.migrated++;
      } catch (err: any) {
        report.totalMovements.errors++;
      }
    }
    addLog(`Wallet movements migrated: ${report.totalMovements.migrated}/${report.totalMovements.read}`);

    // ─── 7. CLIENT HISTORY & INTERACTIONS ───
    addLog('Reading client history logs (historico_cliente)...');
    const historySnap = await getDocs(collection(db, 'historico_cliente'));
    report.totalHistory.read = historySnap.size;

    for (const histDoc of historySnap.docs) {
      const data = histDoc.data();
      const rawParentId = data.cliente_id || data.clientId;
      const pgParentId = firestoreCustMap[rawParentId];

      if (!pgParentId) {
        report.totalHistory.errors++;
        continue;
      }

      try {
        await prisma.customerHistory.create({
          data: {
            customerId: pgParentId,
            actionType: data.tipo_acao || 'OUTRO',
            description: data.descricao || 'Nenhuma descrição.',
            createdAt: data.created_at?.toMillis ? new Date(data.created_at.toMillis()) : new Date(),
          },
        });
        report.totalHistory.migrated++;
      } catch {
        report.totalHistory.errors++;
      }
    }
    addLog(`History records migrated: ${report.totalHistory.migrated}/${report.totalHistory.read}`);

    addLog('ETL execution completed successfully!');
  } catch (error: any) {
    addLog(`FATAL ERROR DURING ETL PIPELINE: ${error.message}`);
    console.error('ETL Pipeline Failed:', error);
  }

  return report;
}
