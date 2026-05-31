// Set test environment variable before any imports
process.env.TEST_MODE = 'true';

import { prisma } from '../src/lib/prisma';
import {
  createProductCategory,
  createSupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  createInventoryMovement,
  getProducts,
  getProductById,
  getProductCategories,
  getSuppliers,
  getInventoryMovements,
  getProductInventoryMovements,
  getProductPriceHistory
} from '../src/lib/crm/products-actions';

// Setup test report map to store results and output them in the exact requested order (1 to 12)
const testResultsMap: Record<number, { name: string; status: 'PASSED' | 'FAILED'; error?: string }> = {};

function recordResult(caseNum: number, name: string, success: boolean, errorMsg?: string) {
  if (success) {
    console.log(`[PASS] Case ${caseNum}: ${name}`);
    testResultsMap[caseNum] = { name, status: 'PASSED' };
  } else {
    console.error(`[FAIL] Case ${caseNum}: ${name}: ${errorMsg}`);
    testResultsMap[caseNum] = { name, status: 'FAILED', error: errorMsg };
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
  console.log('Starting Products & Inventory Action Tests...');

  let categoryId: string | null = null;
  let supplierId: string | null = null;
  let productId: string | null = null;
  let variantId: string | null = null;

  // Cleanup leftover test data
  try {
    const existingProd = await prisma.product.findFirst({
      where: { internalCode: 'T-PROD-FLOW-123', companyId: adminUser.companyId }
    });
    if (existingProd) {
      await prisma.productPriceHistory.deleteMany({ where: { productId: existingProd.id } });
      await prisma.inventoryMovement.deleteMany({ where: { variant: { productId: existingProd.id } } });
      await prisma.productVariant.deleteMany({ where: { productId: existingProd.id } });
      await prisma.product.delete({ where: { id: existingProd.id } });
    }

    const existingCat = await prisma.productCategory.findFirst({
      where: { name: 'TEST_CAT_FLOW', companyId: adminUser.companyId }
    });
    if (existingCat) {
      await prisma.productCategory.delete({ where: { id: existingCat.id } });
    }

    const existingSup = await prisma.supplier.findFirst({
      where: { name: 'TEST_SUP_FLOW', companyId: adminUser.companyId }
    });
    if (existingSup) {
      await prisma.supplier.delete({ where: { id: existingSup.id } });
    }
  } catch (err) {}

  // =========================================================================
  // Case 4: Criar categoria
  // =========================================================================
  try {
    const res = await createProductCategory({
      name: 'TEST_CAT_FLOW',
      description: 'Categoria de teste'
    });
    if (res.success && res.data) {
      categoryId = res.data.id;
      recordResult(4, 'Criar categoria', true);
    } else {
      recordResult(4, 'Criar categoria', false, res.error);
    }
  } catch (e: any) {
    recordResult(4, 'Criar categoria', false, e.message);
  }

  // =========================================================================
  // Case 5: Criar fornecedor
  // =========================================================================
  try {
    const res = await createSupplier({
      name: 'TEST_SUP_FLOW',
      cnpjCpf: '12345678901',
      email: 'fornecedorteste@example.com',
      phone: '9999999999'
    });
    if (res.success && res.data) {
      supplierId = res.data.id;
      recordResult(5, 'Criar fornecedor', true);
    } else {
      recordResult(5, 'Criar fornecedor', false, res.error);
    }
  } catch (e: any) {
    recordResult(5, 'Criar fornecedor', false, e.message);
  }

  // =========================================================================
  // Case 1: Criar produto
  // =========================================================================
  try {
    const res = await createProduct({
      name: 'TEST_PROD_FLOW',
      internalCode: 'T-PROD-FLOW-123',
      categoryId,
      supplierId,
      costPrice: 50.00,
      salePrice: 100.00,
      minimumStock: 5.00,
      barcode: '1234567890123'
    });
    if (res.success && res.data) {
      productId = res.data.id;
      const variant = await prisma.productVariant.findFirst({
        where: { productId, name: 'Único' }
      });
      variantId = variant?.id || null;
      recordResult(1, 'Criar produto', true);
    } else {
      recordResult(1, 'Criar produto', false, res.error);
    }
  } catch (e: any) {
    recordResult(1, 'Criar produto', false, e.message);
  }

  if (!productId || !variantId) {
    console.error('Product or variant creation failed. Stopping tests.');
    process.exit(1);
  }

  // =========================================================================
  // Case 2: Editar produto
  // =========================================================================
  try {
    const res = await updateProduct(productId, {
      name: 'TEST_PROD_FLOW_UPDATED',
      internalCode: 'T-PROD-FLOW-123',
      categoryId,
      supplierId,
      costPrice: 60.00, // custo subiu
      salePrice: 120.00, // venda subiu
      minimumStock: 8.00
    });
    if (res.success && res.data) {
      recordResult(2, 'Editar produto', true);
    } else {
      recordResult(2, 'Editar produto', false, res.error);
    }
  } catch (e: any) {
    recordResult(2, 'Editar produto', false, e.message);
  }

  // =========================================================================
  // Case 6: Entrada de estoque
  // =========================================================================
  try {
    const res = await createInventoryMovement({
      variantId,
      quantity: 20.00,
      type: 'MANUAL_ADJUSTMENT',
      reason: 'Entrada de teste',
      warehouseId: 'LOJA_PRINCIPAL'
    });
    if (res.success) {
      recordResult(6, 'Entrada de estoque', true);
    } else {
      recordResult(6, 'Entrada de estoque', false, res.error);
    }
  } catch (e: any) {
    recordResult(6, 'Entrada de estoque', false, e.message);
  }

  // =========================================================================
  // Case 7: Saída de estoque
  // =========================================================================
  try {
    const res = await createInventoryMovement({
      variantId,
      quantity: -5.00,
      type: 'MANUAL_ADJUSTMENT',
      reason: 'Saída de teste',
      warehouseId: 'LOJA_PRINCIPAL'
    });
    if (res.success) {
      recordResult(7, 'Saída de estoque', true);
    } else {
      recordResult(7, 'Saída de estoque', false, res.error);
    }
  } catch (e: any) {
    recordResult(7, 'Saída de estoque', false, e.message);
  }

  // =========================================================================
  // Case 8: Bloqueio de estoque negativo
  // =========================================================================
  try {
    // Desativar estoque negativo na empresa temporariamente
    await prisma.company.update({
      where: { id: adminUser.companyId },
      data: { allowNegativeStockOnManualAdjustment: false }
    });

    // Tentativa de retirar mais estoque do que possuímos (15.00 atual)
    const res = await createInventoryMovement({
      variantId,
      quantity: -25.00,
      type: 'MANUAL_ADJUSTMENT',
      reason: 'Ajuste manual para forçar saldo negativo',
      warehouseId: 'LOJA_PRINCIPAL'
    });

    if (!res.success && res.error?.includes('Estoque insuficiente')) {
      recordResult(8, 'Bloqueio de estoque negativo', true);
    } else {
      recordResult(8, 'Bloqueio de estoque negativo', false, res.error || 'Ajuste negativo indevidamente permitido');
    }
  } catch (e: any) {
    recordResult(8, 'Bloqueio de estoque negativo', false, e.message);
  } finally {
    // Restaurar configuração original
    await prisma.company.update({
      where: { id: adminUser.companyId },
      data: { allowNegativeStockOnManualAdjustment: true }
    });
  }

  // =========================================================================
  // Case 9: Histórico de preço
  // =========================================================================
  try {
    const res = await getProductPriceHistory(productId);
    if (res.success && res.data && res.data.length >= 2) {
      // Deve ter o inicial (50 -> 100) e a alteração (60 -> 120)
      const foundChange = res.data.some(
        (h: any) => Number(h.oldCostPrice) === 50 && Number(h.newCostPrice) === 60
      );
      if (foundChange) {
        recordResult(9, 'Histórico de preço', true);
      } else {
        recordResult(9, 'Histórico de preço', false, 'Registro de mudança de preço não encontrado no histórico');
      }
    } else {
      recordResult(9, 'Histórico de preço', false, res.error || 'Histórico de preços insuficiente');
    }
  } catch (e: any) {
    recordResult(9, 'Histórico de preço', false, e.message);
  }

  // =========================================================================
  // Case 10: Auditoria/logs
  // =========================================================================
  try {
    const logs = await prisma.activityLog.findMany({
      where: {
        recordId: productId,
        module: 'Produtos',
      }
    });
    // Deve ter pelo menos CRIAR e EDITAR
    if (logs.length >= 2) {
      recordResult(10, 'Auditoria/logs', true);
    } else {
      recordResult(10, 'Auditoria/logs', false, `Logs encontrados: ${logs.length}`);
    }
  } catch (e: any) {
    recordResult(10, 'Auditoria/logs', false, e.message);
  }

  // =========================================================================
  // Case 11: Permissões
  // =========================================================================
  try {
    // Definir mock session para usuário sem permissão
    (global as any).mockSession = {
      userId: staffUser.id,
      companyId: staffUser.companyId,
      name: staffUser.name,
      email: staffUser.email,
      role: 'Vendedor/Caixa',
      isAdmin: false,
      permissions: {},
    };

    const res = await updateProduct(productId, {
      name: 'Nome Inválido Sem Permissao',
      internalCode: 'T-PROD-FLOW-123'
    });

    if (res.success) {
      recordResult(11, 'Permissões', false, 'Ação permitida sem autorização');
    } else {
      recordResult(11, 'Permissões', true);
    }
  } catch (err: any) {
    if (err.message.includes('TEST_REDIRECT_TO') || err.message.includes('permission')) {
      recordResult(11, 'Permissões', true);
    } else {
      recordResult(11, 'Permissões', false, `Exceção inesperada: ${err.message}`);
    }
  } finally {
    // Restaurar sessão admin
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

  // =========================================================================
  // Case 12: Consulta de estoque final
  // =========================================================================
  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId }
    });
    // 0 inicial + 20 entrada - 5 saída = 15 final
    if (variant && Number(variant.currentStock) === 15.00) {
      recordResult(12, 'Consulta de estoque final', true);
    } else {
      recordResult(12, 'Consulta de estoque final', false, `Estoque esperado 15.00, obtido: ${variant?.currentStock}`);
    }
  } catch (e: any) {
    recordResult(12, 'Consulta de estoque final', false, e.message);
  }

  // =========================================================================
  // Case 3: Inativar produto
  // =========================================================================
  try {
    const res = await deleteProduct(productId);
    if (res.success) {
      const dbProd = await prisma.product.findUnique({ where: { id: productId } });
      const dbVariant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      if (dbProd && !dbProd.isActive && dbProd.archivedAt && dbVariant && !dbVariant.isActive) {
        recordResult(3, 'Inativar produto', true);
      } else {
        recordResult(3, 'Inativar produto', false, 'Flags de soft delete incorretas no banco');
      }
    } else {
      recordResult(3, 'Inativar produto', false, res.error);
    }
  } catch (e: any) {
    recordResult(3, 'Inativar produto', false, e.message);
  }

  // Final Cleanup
  try {
    await prisma.productPriceHistory.deleteMany({ where: { productId } });
    await prisma.inventoryMovement.deleteMany({ where: { variantId } });
    await prisma.productVariant.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    if (categoryId) {
      await prisma.productCategory.delete({ where: { id: categoryId } });
    }
    if (supplierId) {
      await prisma.supplier.delete({ where: { id: supplierId } });
    }
    console.log('Test data cleaned up.');
  } catch (err) {}

  console.log('\n==================================================');
  console.log('PRODUCTS ACTIONS TEST FLOW SUMMARY REPORT');
  console.log('==================================================');
  for (let i = 1; i <= 12; i++) {
    const result = testResultsMap[i];
    if (result) {
      console.log(`${result.status === 'PASSED' ? '[PASSED]' : '[FAILED]'} - ${i}. ${result.name}${result.error ? ` (Error: ${result.error})` : ''}`);
    } else {
      console.log(`[FAILED] - ${i}. Test Case missing!`);
    }
  }
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
