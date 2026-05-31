// Set test environment variable before any imports
process.env.TEST_MODE = 'true';

import { prisma } from '../src/lib/prisma';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createChild,
  deleteChild,
  createTag,
  deleteTag,
  addTagToCustomer,
  removeTagFromCustomer,
  adjustWalletBalance,
  getCustomerHistory,
  getBirthdayList
} from '../src/lib/crm/actions';

// Setup test report
const testResults: { name: string; status: 'PASSED' | 'FAILED'; error?: string }[] = [];

function recordResult(name: string, success: boolean, errorMsg?: string) {
  if (success) {
    console.log(`[PASS] ${name}`);
    testResults.push({ name, status: 'PASSED' });
  } else {
    console.error(`[FAIL] ${name}: ${errorMsg}`);
    testResults.push({ name, status: 'FAILED', error: errorMsg });
  }
}

async function runTests() {
  console.log('Fetching seeded users from database...');
  let adminUser = await prisma.user.findFirst({
    where: { companyId: '2052613e-1e1a-4796-95cd-eb2b35ef7eb9' }
  });
  
  if (!adminUser) {
    console.log('Criando usuário temporário para testes...');
    adminUser = await prisma.user.create({
      data: {
        companyId: '2052613e-1e1a-4796-95cd-eb2b35ef7eb9',
        name: 'Test Admin',
        email: 'testadmin@neex.com',
        pinAccessHash: '1234',
        status: 'ACTIVE'
      }
    });
  }

  let staffUser = adminUser;

  // Set the global mock session with real database IDs
  (global as any).mockSession = {
    userId: adminUser.id,
    companyId: adminUser.companyId,
    name: adminUser.name,
    email: adminUser.email,
    role: 'Administrador',
    isAdmin: true,
    permissions: {},
  };

  console.log(`Using mock session user: ${adminUser.name} (${adminUser.id})`);
  console.log('Starting CRM Action Tests...');

  let testCustomerId: string | null = null;
  let testChildId: string | null = null;
  let testTagId: string | null = null;

  const testPhone = '99999999999';

  // Cleanup potential leftover test data
  try {
    const existingCust = await prisma.customer.findFirst({
      where: { phone: testPhone, companyId: adminUser.companyId }
    });
    if (existingCust) {
      await prisma.customer.delete({ where: { id: existingCust.id } });
    }
    const existingTag = await prisma.customerTag.findFirst({
      where: { name: 'TEST_VIP', companyId: adminUser.companyId }
    });
    if (existingTag) {
      await prisma.customerTag.delete({ where: { id: existingTag.id } });
    }
  } catch (err) {}

  // 1. Test Case: Criar cliente
  try {
    const res = await createCustomer({
      name: 'Cliente Teste Flow',
      email: 'clienteteste@example.com',
      phone: testPhone,
      cpf: '111.222.333-44',
      birthDay: 15,
      birthMonth: 5,
      birthYear: 1990,
      instagram: '@clienteteste',
      notes: 'Notas de teste',
      status: 'ativo',
    });

    if (res.success && res.data) {
      testCustomerId = res.data.id;
      recordResult('1. Criar cliente', true);
    } else {
      recordResult('1. Criar cliente', false, res.error);
    }
  } catch (e: any) {
    recordResult('1. Criar cliente', false, e.message);
  }

  if (!testCustomerId) {
    console.error('Customer creation failed, stopping further tests.');
    process.exit(1);
  }

  // 2. Test Case: Editar cliente
  try {
    const res = await updateCustomer(testCustomerId, {
      name: 'Cliente Teste Flow Alterado',
      email: 'clienteteste@example.com',
      phone: testPhone,
      cpf: '111.222.333-44',
      birthDay: 15,
      birthMonth: 5,
      birthYear: 1990,
      instagram: '@clienteteste',
      notes: 'Notas de teste alteradas',
      status: 'ativo',
    });

    if (res.success && res.data && res.data.name === 'Cliente Teste Flow Alterado') {
      recordResult('2. Editar cliente', true);
    } else {
      recordResult('2. Editar cliente', false, res.error || 'Nome não foi alterado');
    }
  } catch (e: any) {
    recordResult('2. Editar cliente', false, e.message);
  }

  // 4. Test Case: Criar filho vinculado
  try {
    const res = await createChild({
      customerId: testCustomerId,
      name: 'Filho Teste Flow',
      birthDate: '2020-05-20',
      gender: 'M',
      clothingSize: '4',
      shoeSize: '26',
      notes: 'Nenhuma alergia',
    });

    if (res.success && res.data) {
      testChildId = res.data.id;
      recordResult('4. Criar filho vinculado', true);
    } else {
      recordResult('4. Criar filho vinculado', false, res.error);
    }
  } catch (e: any) {
    recordResult('4. Criar filho vinculado', false, e.message);
  }

  // 5. Test Case: Adicionar tag ao cliente
  try {
    const tagRes = await createTag('TEST_VIP', '#ff0000');
    if (tagRes.success && tagRes.data) {
      testTagId = tagRes.data.id;
      const linkRes = await addTagToCustomer(testCustomerId, testTagId);
      if (linkRes.success) {
        recordResult('5. Adicionar tag ao cliente', true);
      } else {
        recordResult('5. Adicionar tag ao cliente', false, 'Falha ao vincular tag');
      }
    } else {
      recordResult('5. Adicionar tag ao cliente', false, tagRes.error);
    }
  } catch (e: any) {
    recordResult('5. Adicionar tag ao cliente', false, e.message);
  }

  // 6. Test Case: Remover tag
  try {
    if (testTagId) {
      const res = await removeTagFromCustomer(testCustomerId, testTagId);
      if (res.success) {
        recordResult('6. Remover tag', true);
      } else {
        recordResult('6. Remover tag', false, res.error);
      }
    } else {
      recordResult('6. Remover tag', false, 'Tag ID não definido');
    }
  } catch (e: any) {
    recordResult('6. Remover tag', false, e.message);
  }

  // 7. Test Case: Criar crédito na carteira
  try {
    const res = await adjustWalletBalance({
      customerId: testCustomerId,
      amount: 150.00,
      type: 'credit',
      reason: 'Bônus de teste de crédito',
    });

    if (res.success) {
      recordResult('7. Criar crédito na carteira', true);
    } else {
      recordResult('7. Criar crédito na carteira', false, res.error);
    }
  } catch (e: any) {
    recordResult('7. Criar crédito na carteira', false, e.message);
  }

  // 8. Test Case: Criar débito na carteira
  try {
    const res = await adjustWalletBalance({
      customerId: testCustomerId,
      amount: 50.00,
      type: 'debit',
      reason: 'Compra com créditos',
    });

    if (res.success) {
      recordResult('8. Criar débito na carteira', true);
    } else {
      recordResult('8. Criar débito na carteira', false, res.error);
    }
  } catch (e: any) {
    recordResult('8. Criar débito na carteira', false, e.message);
  }

  // 9. Test Case: Conferir saldo final
  try {
    const wallet = await prisma.customerWallet.findUnique({
      where: { customerId: testCustomerId }
    });
    if (wallet && Number(wallet.balance) === 100.00) {
      recordResult('9. Conferir saldo final (Esperado: 100.00)', true);
    } else {
      recordResult('9. Conferir saldo final', false, `Saldo incorreto: R$ ${wallet?.balance}`);
    }
  } catch (e: any) {
    recordResult('9. Conferir saldo final', false, e.message);
  }

  // 10. Test Case: Ver histórico do cliente
  try {
    const res = await getCustomerHistory(testCustomerId);
    if (res.success && res.data && res.data.length >= 4) {
      recordResult('10. Ver histórico do cliente', true);
    } else {
      recordResult('10. Ver histórico do cliente', false, `Registros insuficientes no histórico: ${res.data?.length}`);
    }
  } catch (e: any) {
    recordResult('10. Ver histórico do cliente', false, e.message);
  }

  // 11. Test Case: Filtrar aniversariantes
  try {
    const res = await getBirthdayList(5);
    if (res.success && res.customers && res.children) {
      const customerFound = res.customers.some((c: any) => c.id === testCustomerId);
      const childFound = res.children.some((c: any) => c.id === testChildId);
      if (customerFound && childFound) {
        recordResult('11. Filtrar aniversariantes', true);
      } else {
        recordResult('11. Filtrar aniversariantes', false, `Customer found: ${customerFound}, Child found: ${childFound}`);
      }
    } else {
      recordResult('11. Filtrar aniversariantes', false, res.error);
    }
  } catch (e: any) {
    recordResult('11. Filtrar aniversariantes', false, e.message);
  }

  // 12. Test Case: Testar bloqueio de permissão para usuário sem acesso
  try {
    // Set mock session to a user without Clientes:criar permission
    (global as any).mockSession = {
      userId: staffUser.id,
      companyId: staffUser.companyId,
      name: staffUser.name,
      email: staffUser.email,
      role: 'Vendedor/Caixa',
      isAdmin: false,
      permissions: {}, // no permissions
    };

    // Attempt to create customer, should fail due to requirePermission
    try {
      const res = await createCustomer({
        name: 'Cliente Bloqueado',
        phone: '12345678',
        status: 'ativo'
      });
      // Server Action returns error or throws, check if it blocked or failed
      if (res.success) {
        recordResult('12. Testar bloqueio de permissão para usuário sem acesso', false, 'Allowed action without permission!');
      } else {
        recordResult('12. Testar bloqueio de permissão para usuário sem acesso', true);
      }
    } catch (err: any) {
      if (err.message.includes('TEST_REDIRECT_TO')) {
        recordResult('12. Testar bloqueio de permissão para usuário sem acesso', true);
      } else {
        recordResult('12. Testar bloqueio de permissão para usuário sem acesso', false, `Unexpected exception: ${err.message}`);
      }
    }
  } catch (e: any) {
    recordResult('12. Testar bloqueio de permissão para usuário sem acesso', false, e.message);
  } finally {
    // Restore admin session
    (global as any).mockSession = {
      userId: adminUser.id,
      companyId: adminUser.companyId,
      name: adminUser.name,
      email: adminUser.email,
      role: 'Administrador',
      isAdmin: true,
      permissions: {},
    };
  }

  // 3. Test Case: Excluir/inativar cliente
  try {
    const deleteRes = await deleteCustomer(testCustomerId);
    if (deleteRes.success) {
      const updatedCust = await prisma.customer.findUnique({ where: { id: testCustomerId } });
      if (updatedCust && updatedCust.status === 'arquivado') {
        recordResult('3. Excluir/inativar cliente', true);
      } else {
        recordResult('3. Excluir/inativar cliente', false, `Customer status is: ${updatedCust?.status}`);
      }
    } else {
      recordResult('3. Excluir/inativar cliente', false, deleteRes.error);
    }
  } catch (e: any) {
    recordResult('3. Excluir/inativar cliente', false, e.message);
  }

  // Final Cleanup
  try {
    await prisma.customer.delete({ where: { id: testCustomerId } });
    if (testTagId) {
      await prisma.customerTag.delete({ where: { id: testTagId } });
    }
    console.log('Test data cleaned up.');
  } catch (err) {}

  console.log('\n==================================================');
  console.log('CRM ACTIONS TEST FLOW SUMMARY REPORT');
  console.log('==================================================');
  testResults.forEach(res => {
    console.log(`${res.status === 'PASSED' ? '[PASSED]' : '[FAILED]'} - ${res.name}${res.error ? ` (Error: ${res.error})` : ''}`);
  });
  console.log('==================================================');
}

runTests()
  .catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
