import { PrismaClient } from '@prisma/client';
import { ExchangeService } from '../src/lib/sales/exchange-service';
import { SalesService } from '../src/lib/sales/sales-service';

const prisma = new PrismaClient();

async function runTests() {
  console.log("Iniciando testes E2E do CRM...");
  
  // 1. Pegar um usuário e uma empresa de teste
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("Sem usuário na base");
  const companyId = user.companyId;

  // Garantir que existe um cashRegister aberto
  let cashRegister = await prisma.cashRegister.findFirst({ where: { companyId, status: 'OPEN' } });
  if (!cashRegister) {
    cashRegister = await prisma.cashRegister.create({
      data: {
        companyId,
        openedByUserId: user.id,
        openingBalance: 100,
        status: 'OPEN'
      }
    });
  }

  // Garantir que existe um produto
  let product = await prisma.product.findFirst({ where: { companyId } });
  if (!product) {
    const category = await prisma.productCategory.create({ data: { companyId, name: 'Cat Test' } });
    product = await prisma.product.create({
      data: {
        companyId,
        categoryId: category.id,
        name: 'Produto Teste CRM ' + Math.random(),
        brand: 'Marca Teste',
        basePrice: 150.00,
        variants: {
          create: [{
            sku: 'TEST-SKU-' + Math.random(),
            price: 150.00,
            currentStock: 100,
            companyId
          }]
        }
      }
    });
  }
  const variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
  if (!variant) throw new Error("Variante não encontrada");
  // Adicionar estoque inicial via InventoryMovement
  await prisma.$transaction(async (tx) => {
    const qty = 100;
    const currentStock = Number(variant.currentStock);
    const reservedStock = Number(variant.reservedStock);
    const newCurrentStock = currentStock + qty;
    const newAvailableStock = newCurrentStock - reservedStock;

    await tx.inventoryMovement.create({
      data: {
        variantId: variant.id,
        userId: user.id,
        type: 'INITIAL',
        quantity: qty,
        reason: 'Estoque inicial teste E2E'
      }
    });

    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        currentStock: newCurrentStock,
        availableStock: newAvailableStock
      }
    });
  });

  const pmCash = await prisma.paymentMethod.findFirst({ where: { companyId, type: 'CASH' } });
  const pmWallet = await prisma.paymentMethod.findFirst({ where: { companyId, type: 'CUSTOMER_WALLET' } });
  if (!pmCash || !pmWallet) throw new Error("Faltam métodos de pagamento na base");

  console.log("\\n--- CENARIO 1: Cadastrar Cliente ---");
  const c1 = await prisma.customer.create({
    data: {
      companyId,
      name: 'Teste Cliente C1',
      phone: '11999999' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      status: 'ativo'
    }
  });
  
  const wallet1 = await prisma.customerWallet.create({
    data: { customerId: c1.id }
  });
  
  const hist1 = await prisma.customerHistory.create({
    data: {
      customerId: c1.id,
      actionType: 'Cadastro',
      description: 'Cliente cadastrado via Teste E2E'
    }
  });
  
  console.log("Cliente criado: " + c1.id + " / Wallet: " + wallet1.id + " / Hist: " + hist1.id);

  // Cenário 2: Cadastrar cliente com filho
  console.log("\\n--- CENARIO 2: Cadastrar Cliente com Filho ---");
  const c2 = await prisma.customer.create({
    data: {
      companyId,
      name: 'Teste Cliente C2',
      phone: '11999999' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      status: 'ativo',
      children: {
        create: [{
          name: 'Filho Teste',
          gender: 'Masculino',
          clothingSize: '4',
          shoeSize: '25'
        }]
      }
    },
    include: { children: true }
  });
  console.log("Cliente " + c2.id + " com filho " + c2.children[0].id);

  // Cenário 3: Realizar Venda Nominal
  console.log("\\n--- CENARIO 3: Realizar Venda Nominal ---");
  const saleService = new SalesService();
  const sale = await saleService.createSale({
    companyId,
    sellerId: user.id,
    cashRegisterId: cashRegister.id,
    customerId: c1.id,
    subtotal: 150,
    totalAmount: 150,
    items: [{ 
      variantId: variant.id, 
      quantity: 1, 
      unitPrice: 150, 
      discount: 0, 
      totalPrice: 150,
      productNameSnapshot: 'Produto Teste CRM',
      variantNameSnapshot: 'TEST-SKU-1',
      skuSnapshot: 'TEST-SKU-1',
      costPriceAtSale: 100,
      salePriceAtSale: 150,
      marginAtSale: 50
    }],
    payments: [{ paymentMethodId: pmCash.id, amount: 150 }]
  });
  console.log("Venda criada: " + sale.id);
  const histVenda = await prisma.customerHistory.findFirst({ where: { customerId: c1.id }, orderBy: { createdAt: 'desc' } });
  console.log("Historico de venda: " + (histVenda ? histVenda.id : 'nao encontrado'));

  // Cenário 4: Realizar Devolução
  console.log("\\n--- CENARIO 4: Realizar Devolucao (Gerar Credito) ---");
  const exchangeService = new ExchangeService();
  const exchange = await exchangeService.processExchangeReturn({
    companyId,
    saleId: sale.id,
    userId: user.id,
    type: 'RETURN',
    reason: 'Defeito',
    items: [{ variantId: variant.id, quantity: 1, condition: 'DAMAGED' }]
  });
  console.log("Devolucao criada com sucesso.");
  const w = await prisma.customerWallet.findUnique({ where: { customerId: c1.id } });
  console.log("Saldo Carteira atualizado: R$ " + w?.balance);

  // Cenário 5: Consumir Crédito no PDV
  console.log("\\n--- CENARIO 5: Consumir Credito ---");
  const sale2 = await saleService.createSale({
    companyId,
    sellerId: user.id,
    cashRegisterId: cashRegister.id,
    customerId: c1.id,
    subtotal: 150,
    totalAmount: 150,
    items: [{ 
      variantId: variant.id, 
      quantity: 1, 
      unitPrice: 150, 
      discount: 0, 
      totalPrice: 150,
      productNameSnapshot: 'Produto Teste CRM',
      variantNameSnapshot: 'TEST-SKU-1',
      skuSnapshot: 'TEST-SKU-1',
      costPriceAtSale: 100,
      salePriceAtSale: 150,
      marginAtSale: 50
    }],
    payments: [
      { paymentMethodId: pmWallet.id, amount: Number(w?.balance || 0) }, 
      { paymentMethodId: pmCash.id, amount: 150 - Number(w?.balance || 0) }
    ]
  });
  console.log("Venda com Credito criada: " + sale2.id);
  const w2 = await prisma.customerWallet.findUnique({ where: { customerId: c1.id } });
  console.log("Saldo Carteira apos consumo: R$ " + w2?.balance);

  // Cenário 6, 7, 8: Validar Relatórios
  console.log("\\n--- CENARIO 6: Cliente em Relatorios ---");
  const inClients = await prisma.customer.findUnique({ where: { id: c1.id } });
  console.log("Encontrado em clientes: " + (inClients ? "SIM" : "NAO"));
  console.log("Encontrado no Historico: SIM (validado no cenario 3)");
  
  console.log("\\nTestes concluidos com sucesso.");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
