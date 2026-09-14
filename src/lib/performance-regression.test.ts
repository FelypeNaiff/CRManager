import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('auth context uses React request cache and no process-global cache', () => {
  const code = source('./auth/server-auth-context.ts');
  assert.match(code, /import \{ cache \} from 'react'/);
  assert.match(code, /resolveBaseServerAuthContextForRequest = cache\(async/);
  assert.match(code, /resolveServerAuthContextForRequest = cache\(async/);
  assert.doesNotMatch(code, /unstable_cache|new Map/);
});

test('request cache boundaries remain owned by React and cannot cross users', () => {
  const code = source('./auth/server-auth-context.ts');
  assert.match(code, /A new request receives a fresh cache scope/);
  assert.doesNotMatch(code, /globalThis\.(auth|serverAuth)|globalForAuth/i);
});

test('profile selector validation remains inside cached context resolution', () => {
  const code = source('./auth/server-auth-context.ts');
  assert.match(code, /verifyProfileSelector/);
  assert.match(code, /resolveSelectedContext\(baseContext, selectorToken/);
});

test('main dashboard uses one server action and parallel data loaders', () => {
  const page = source('../app/(dashboard)/dashboard/page.tsx');
  const action = source('./dashboard/dashboard-actions.ts');
  assert.match(page, /await getMainDashboardDataAction/);
  assert.doesNotMatch(page, /await getCustomers|await getFinancialDashboardSummary|await listSalesAction/);
  assert.match(action, /await Promise\.all/);
});

test('commercial dashboard starts independent queries before awaiting them', () => {
  const code = source('./reports/commercial-report-service.ts');
  assert.match(code, /aggregatedPromise = prisma\.sale\.aggregate/);
  assert.match(code, /await Promise\.all\(\[\s*aggregatedPromise,/);
});

test('CRM segmentation runs independent aggregates concurrently', () => {
  const code = source('./crm/actions.ts');
  assert.match(code, /salesGroupedPromise = prisma\.sale\.groupBy/);
  assert.match(code, /await Promise\.all\(\[\s*salesGroupedPromise,/);
});

test('children query keeps tenant scope while selecting only consumed customer data', () => {
  const code = source('./crm/actions.ts');
  assert.match(code, /where: \{ companyId: session\.companyId \}/);
  assert.match(code, /customer: \{ select: \{ name: true \} \}/);
});

test('runtime Prisma remains a single global development singleton', () => {
  const code = source('./prisma.ts');
  assert.match(code, /globalThis/);
  assert.match(code, /new PrismaClient/);
  assert.match(code, /globalForPrisma\.prisma = prisma/);
});
