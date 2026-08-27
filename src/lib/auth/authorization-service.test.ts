import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthorizationService } from './authorization-service';

const pending = {
  id: 'auth-1', companyId: 'company-1', requestedByUserId: 'operator-1',
  type: 'WALLET_CREDIT', module: 'CARTEIRA', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
  amount: null, percentage: null,
};

function harness(options: { pinValid?: boolean; authorization?: any; authorizer?: any } = {}) {
  const updates: any[] = [];
  const authorization = options.authorization === undefined ? { ...pending } : { ...options.authorization };
  const pinUser = { id: 'manager-1', companyId: 'company-1', authorizationPinHash: 'hash' };
  const authorizer = options.authorizer === undefined ? {
    ...pinUser, name: 'Manager', status: 'ACTIVE', permitirAcesso: true, pinResetRequired: false,
    roleId: 'role-1', role: { id: 'role-1', name: 'Manager', isAdmin: false, permissions: [{ module: 'CARTEIRA', action: 'AUTHORIZE', allowed: true }] },
  } : options.authorizer;
  const db: any = {
    user: {
      findMany: async ({ where }: any) => where.companyId === 'company-1' ? [pinUser] : [],
      findUnique: async ({ where }: any) => where.id === 'manager-1' ? authorizer : null,
    },
    actionAuthorization: {
      findFirst: async ({ where }: any) => authorization && where.id === authorization.id && where.companyId === authorization.companyId ? authorization : null,
      updateMany: async (args: any) => { updates.push(args); Object.assign(authorization, args.data); return { count: 1 }; },
    },
  };
  db.$transaction = async (fn: (tx: any) => unknown) => fn(db);
  const service = new AuthorizationService(db, async () => options.pinValid !== false);
  return { service, updates };
}

test('valid PIN approves own-tenant request using server-resolved authorizer', async () => {
  const { service, updates } = harness();
  await service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'secret', authorizerId: 'forged', approvedByUserId: 'forged' } as any);
  assert.equal(updates[0].data.authorizedByUserId, 'manager-1');
});

test('invalid PIN is denied', async () => {
  const { service } = harness({ pinValid: false });
  await assert.rejects(service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'wrong' }));
});

test('authorization and PIN lookup are tenant scoped', async () => {
  const { service } = harness();
  await assert.rejects(service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-2', pin: 'secret' }));
});

test('authorizer without RBAC authority is denied', async () => {
  const { service } = harness({ authorizer: { id: 'manager-1', companyId: 'company-1', name: 'No access', status: 'ACTIVE', permitirAcesso: true, pinResetRequired: false, roleId: 'role-2', role: { isAdmin: false, permissions: [] } } });
  await assert.rejects(service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'secret' }));
});

test('admin from another tenant is denied', async () => {
  const { service } = harness({ authorizer: { id: 'manager-1', companyId: 'company-2', status: 'ACTIVE', permitirAcesso: true, pinResetRequired: false, role: { isAdmin: true, permissions: [] } } });
  await assert.rejects(service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'secret' }));
});

test('authorization with a noncanonical module is denied', async () => {
  const { service } = harness({ authorization: { ...pending, module: 'CAIXA' } });
  await assert.rejects(service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'secret' }));
});

test('forged rejecter fields do not influence rejection', async () => {
  const { service, updates } = harness();
  await service.rejectAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'secret', rejectionReason: 'Denied', rejecterId: 'forged', rejectedByUserId: 'forged' } as any);
  assert.equal(updates[0].data.rejectedByUserId, 'manager-1');
});

for (const status of ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']) {
  test(`${status} authorization cannot transition again`, async () => {
    const { service } = harness({ authorization: { ...pending, status } });
    await assert.rejects(service.approveAuthorizationWithPin({ authorizationId: 'auth-1', companyId: 'company-1', pin: 'secret' }));
  });
}
