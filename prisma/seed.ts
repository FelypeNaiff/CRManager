import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Create Company
  const company = await prisma.company.upsert({
    where: { cnpjCpf: '12345678000199' },
    update: {},
    create: {
      cnpjCpf: '12345678000199',
      razaoSocial: 'NEEX - Sistema de Gestão de Vendas',
      nomeFantasia: 'NEEX',
      tipoPessoa: 'PJ',
      telefone: '96999999999',
      email: 'contato@neex.com.br',
    },
  });
  console.log(`Company created/found: ${company.nomeFantasia} (${company.id})`);

  // 2. Create Roles
  const adminRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Administrador',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: 'Administrador',
      description: 'Acesso total ao sistema',
      isAdmin: true,
      status: 'ACTIVE',
    },
  });
  console.log(`Role created/found: ${adminRole.name} (${adminRole.id})`);

  const staffRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Vendedor/Caixa',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: 'Vendedor/Caixa',
      description: 'Acesso básico a vendas, clientes e PDV',
      isAdmin: false,
      status: 'ACTIVE',
    },
  });
  console.log(`Role created/found: ${staffRole.name} (${staffRole.id})`);

  // 3. Create permissions for Vendedor/Caixa
  const basicPermissions = [
    { module: 'Vendas', action: 'visualizar', allowed: true },
    { module: 'Clientes', action: 'visualizar', allowed: true },
    { module: 'Produtos', action: 'visualizar', allowed: true },
    { module: 'PDV', action: 'visualizar', allowed: true },
    { module: 'Caixa', action: 'visualizar', allowed: true },
    { module: 'Financeiro', action: 'acessar', allowed: false },
    { module: 'Estoque', action: 'visualizar', allowed: false },
    { module: 'Usuários', action: 'visualizar', allowed: false },
  ];

  for (const perm of basicPermissions) {
    await prisma.permission.upsert({
      where: {
        roleId_module_action: {
          roleId: staffRole.id,
          module: perm.module,
          action: perm.action,
        },
      },
      update: {
        allowed: perm.allowed,
      },
      create: {
        roleId: staffRole.id,
        module: perm.module,
        action: perm.action,
        allowed: perm.allowed,
      },
    });
  }
  console.log('Basic permissions for Vendedor/Caixa created/updated.');

  // 4. Create Users (PINs hashed with bcrypt)
  const hashedAdminPin = await bcrypt.hash('1234', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'felypenaiff01@gmail.com' },
    update: {
      companyId: company.id,
      roleId: adminRole.id,
      pinAccessHash: hashedAdminPin,
    },
    create: {
      companyId: company.id,
      roleId: adminRole.id,
      name: 'Felype Naiff',
      email: 'felypenaiff01@gmail.com',
      pinAccessHash: hashedAdminPin,
      status: 'ACTIVE',
      cargo: 'Proprietário / Admin',
      permitirAcesso: true,
    },
  });
  console.log(`Admin user created/found: ${adminUser.name} (${adminUser.email})`);

  const hashedStaffPin = await bcrypt.hash('4321', 10);
  const staffUser = await prisma.user.upsert({
    where: { email: 'caixa@neex.com.br' },
    update: {
      companyId: company.id,
      roleId: staffRole.id,
      pinAccessHash: hashedStaffPin,
    },
    create: {
      companyId: company.id,
      roleId: staffRole.id,
      name: 'Caixa NEEX',
      email: 'caixa@neex.com.br',
      pinAccessHash: hashedStaffPin,
      status: 'ACTIVE',
      cargo: 'Operador de Caixa',
      permitirAcesso: true,
    },
  });
  console.log(`Staff user created/found: ${staffUser.name} (${staffUser.email})`);

  // 5. Create Default Payment Methods
  const defaultPaymentMethods = [
    { name: 'Dinheiro', type: 'CASH', isSystemDefault: true, isActive: true },
    { name: 'PIX', type: 'PIX', isSystemDefault: true, isActive: true },
    { name: 'Débito', type: 'DEBIT_CARD', isSystemDefault: true, isActive: true },
    { name: 'Crédito', type: 'CREDIT_CARD', isSystemDefault: true, isActive: true },
    { name: 'Crediário', type: 'STORE_CREDIT', isSystemDefault: true, isActive: true },
    { name: 'Transferência', type: 'BANK_TRANSFER', isSystemDefault: true, isActive: true },
  ];

  for (const pm of defaultPaymentMethods) {
    await prisma.paymentMethod.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: pm.name,
        },
      },
      update: {
        type: pm.type as any,
        isSystemDefault: pm.isSystemDefault,
        isActive: pm.isActive,
      },
      create: {
        companyId: company.id,
        name: pm.name,
        type: pm.type as any,
        isSystemDefault: pm.isSystemDefault,
        isActive: pm.isActive,
      },
    });
  }
  console.log('Default payment methods created/updated.');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
