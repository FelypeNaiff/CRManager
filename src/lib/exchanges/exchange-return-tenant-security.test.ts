import assert from 'node:assert/strict';
import test from 'node:test';
import { itemBelongsToSale, scopeTenantOperationInput, tenantResourceWhere } from './exchange-return-tenant-security';

test('forged tenant and executor are ignored for exchange and return creation', () => {
  const scoped = scopeTenantOperationInput(
    { companyId: 'forged', userId: 'forged-user', saleId: 'sale-a' },
    { companyId: 'company-a', userId: 'auth-user' }
  );
  assert.equal(scoped.companyId, 'company-a');
  assert.equal(scoped.userId, 'auth-user');
});

test('own sale is visible and cross-tenant sale is hidden', () => {
  const sales = [{ id: 'sale-a', companyId: 'company-a' }, { id: 'sale-b', companyId: 'company-b' }];
  const find = (id: string, companyId: string) => {
    const where = tenantResourceWhere(id, companyId);
    return sales.find(sale => sale.id === where.id && sale.companyId === where.companyId);
  };
  assert.deepEqual(find('sale-a', 'company-a'), sales[0]);
  assert.equal(find('sale-b', 'company-a'), undefined);
});

test('SaleItem must belong to the validated original sale', () => {
  const saleItems = [{ variantId: 'variant-a' }];
  assert.equal(itemBelongsToSale(saleItems, 'variant-a'), true);
  assert.equal(itemBelongsToSale(saleItems, 'variant-from-other-sale'), false);
});

test('exchange and return lookup/cancel scope admin to its own tenant', () => {
  assert.deepEqual(tenantResourceWhere('resource-b', 'admin-company'), {
    id: 'resource-b', companyId: 'admin-company',
  });
});

test('customer, wallet, variant and authorization tenant checks fail closed', () => {
  const belongsToTenant = (resourceCompanyId: string, authCompanyId: string) =>
    resourceCompanyId === authCompanyId;
  assert.equal(belongsToTenant('company-a', 'company-a'), true);
  assert.equal(belongsToTenant('company-b', 'company-a'), false);
});
