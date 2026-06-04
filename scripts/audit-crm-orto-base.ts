// Set test environment variable before any imports
process.env.TEST_MODE = 'true';

import { PrismaClient } from '@prisma/client';
const prismaWithQueryLog = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

// We temporarily replace the global prisma instance with our logged one
import * as prismaModule from '../src/lib/prisma';
(prismaModule as any).prisma = prismaWithQueryLog;

import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createChild,
  getCustomerHistory,
  getCustomers
} from '../src/lib/crm/actions';
import { getCustomerWalletAction } from '../src/lib/wallet/wallet-actions';

// Monkey patch requirePermission and requireAuth directly
import * as permissionsModule from '../src/lib/auth/permissions';
(permissionsModule as any).requirePermission = async () => (global as any).mockSession;
(permissionsModule as any).requireAuth = async () => (global as any).mockSession;

async function runAudit() {
  console.log('--- INICIANDO AUDITORIA CRM-ORTO-BASE ---\n');

  let adminUser = await prismaWithQueryLog.user.findFirst({
    where: { companyId: '2052613e-1e1a-4796-95cd-eb2b35ef7eb9' }
  });
  
  if (!adminUser) {
    adminUser = await prismaWithQueryLog.user.findFirst();
  }

  // Set the global mock session
  (global as any).mockSession = {
    userId: adminUser!.id,
    companyId: adminUser!.companyId,
    name: adminUser!.name,
    email: adminUser!.email,
    role: 'Administrador',
    isAdmin: true,
    permissions: {},
  };

  let customerId = '';

  console.log('\n=========================================');
  console.log('1. Criar cliente sem filhos');
  let payload1 = {
    name: 'Audit Cliente 1',
    phone: '11999999991',
    cpf: '111.111.111-11',
    email: 'audit1@test.com',
    birthDay: 10,
    birthMonth: 10,
    birthYear: 1990,
    status: 'ativo' as const
  };
  console.log('Payload:', JSON.stringify(payload1, null, 2));
  let res1 = await createCustomer(payload1);
  console.log('Response:', JSON.stringify(res1, null, 2));
  if (res1.success) customerId = res1.data.id;

  console.log('\n=========================================');
  console.log('2. Criar cliente com 1 filho');
  let payload2 = {
    name: 'Audit Cliente 2',
    phone: '11999999992',
    status: 'ativo' as const
  };
  console.log('Payload Customer:', JSON.stringify(payload2, null, 2));
  let res2 = await createCustomer(payload2);
  console.log('Response Customer:', JSON.stringify(res2, null, 2));
  if (res2.success) {
    let childPayload1 = { customerId: res2.data.id, name: 'Filho 1' };
    console.log('Payload Child 1:', JSON.stringify(childPayload1, null, 2));
    let cRes1 = await createChild(childPayload1);
    console.log('Response Child 1:', JSON.stringify(cRes1, null, 2));
  }

  console.log('\n=========================================');
  console.log('3. Criar cliente com 2 filhos');
  let payload3 = {
    name: 'Audit Cliente 3',
    phone: '11999999993',
    status: 'ativo' as const
  };
  console.log('Payload Customer:', JSON.stringify(payload3, null, 2));
  let res3 = await createCustomer(payload3);
  console.log('Response Customer:', JSON.stringify(res3, null, 2));
  if (res3.success) {
    let c1 = await createChild({ customerId: res3.data.id, name: 'Filho 1' });
    let c2 = await createChild({ customerId: res3.data.id, name: 'Filho 2' });
    console.log('Response Child 1:', c1.success);
    console.log('Response Child 2:', c2.success);
  }

  console.log('\n=========================================');
  console.log('4. Criar cliente com data de nascimento vazia');
  let payload4 = {
    name: 'Audit Cliente 4',
    phone: '11999999994',
    birthDay: null,
    birthMonth: null,
    birthYear: null,
    status: 'ativo' as const
  };
  console.log('Payload:', JSON.stringify(payload4, null, 2));
  let res4 = await createCustomer(payload4);
  console.log('Response:', JSON.stringify(res4, null, 2));

  console.log('\n=========================================');
  console.log('5. Criar cliente sem e-mail');
  let payload5 = {
    name: 'Audit Cliente 5',
    phone: '11999999995',
    email: '',
    status: 'ativo' as const
  };
  console.log('Payload:', JSON.stringify(payload5, null, 2));
  let res5 = await createCustomer(payload5);
  console.log('Response:', JSON.stringify(res5, null, 2));

  console.log('\n=========================================');
  console.log('6. Criar cliente sem CPF');
  let payload6 = {
    name: 'Audit Cliente 6',
    phone: '11999999996',
    cpf: '',
    status: 'ativo' as const
  };
  console.log('Payload:', JSON.stringify(payload6, null, 2));
  let res6 = await createCustomer(payload6);
  console.log('Response:', JSON.stringify(res6, null, 2));

  console.log('\n=========================================');
  console.log('7. Criar cliente com WhatsApp');
  let payload7 = {
    name: 'Audit Cliente 7',
    phone: '11999999997', // This is Whatsapp
    status: 'ativo' as const
  };
  console.log('Payload:', JSON.stringify(payload7, null, 2));
  let res7 = await createCustomer(payload7);
  console.log('Response:', JSON.stringify(res7, null, 2));

  console.log('\n=========================================');
  console.log('8. Editar cliente existente');
  let payloadEdit = {
    name: 'Audit Cliente 1 Editado',
    phone: '11999999991',
    status: 'ativo' as const
  };
  console.log('Payload Edit:', JSON.stringify(payloadEdit, null, 2));
  let resEdit = await updateCustomer(customerId, payloadEdit);
  console.log('Response Edit:', JSON.stringify(resEdit, null, 2));

  console.log('\n=========================================');
  console.log('9. Excluir cliente');
  console.log('Target ID:', customerId);
  let resDelete = await deleteCustomer(customerId);
  console.log('Response Delete:', JSON.stringify(resDelete, null, 2));

  console.log('\n=========================================');
  console.log('10. Abrir CRM > Carteira (Load customer wallet)');
  let resWallet = await getCustomerWalletAction(res7.data?.id || '');
  console.log('Response Wallet:', JSON.stringify(resWallet, null, 2));

  console.log('\n=========================================');
  console.log('11. Abrir CRM > Clientes (List Customers to check if breaks without wallets)');
  // We temporarily disable prisma logs for list not to flood
  let resList = await getCustomers();
  console.log('Response List Customers:', resList.success ? `Loaded ${resList.data?.length} customers` : resList.error);

  console.log('\n=========================================');
  console.log('12. Abrir CRM > Histórico');
  let resHistory = await getCustomerHistory(res7.data?.id || '');
  console.log('Response History:', JSON.stringify(resHistory, null, 2));

  // Cleanup
  console.log('\nCleaning up audit data...');
  await prismaWithQueryLog.customer.deleteMany({
    where: { name: { startsWith: 'Audit Cliente' } }
  });
  console.log('--- AUDITORIA CONCLUIDA ---');
}

runAudit()
  .catch(e => {
    console.error('Audit crashed:', e);
    process.exit(1);
  })
  .finally(() => prismaWithQueryLog.$disconnect());
