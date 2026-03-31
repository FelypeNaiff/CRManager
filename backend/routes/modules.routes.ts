import { Router } from 'express';
import { createModuleItem, listModuleItems } from '../controllers/modules.controller';

export const modulesRouter = Router();

const modules = [
  'finance/payables',
  'finance/receivables',
  'finance/cashflow',
  'finance/reconciliation',
  'finance/invoices',
  'pos/sales',
  'stock/movements',
  'stock/products',
  'purchases/orders',
  'purchases/quotes',
  'purchases/suppliers',
  'fiscal/nfe',
  'fiscal/nfce',
  'omnichannel/events',
  'meta/leads',
  'agenda/tasks',
  'agenda/appointments',
  'agenda/reminders',
  'bi/dashboards',
  'marketing/campaigns',
  'portal/coupons',
  'portal/purchases',
];

for (const moduleName of modules) {
  modulesRouter.post(`/${moduleName}`, createModuleItem(moduleName));
  modulesRouter.get(`/${moduleName}`, listModuleItems(moduleName));
}
