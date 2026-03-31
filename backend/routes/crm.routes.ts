import { Router } from 'express';
import {
  addInteraction,
  createCustomer,
  createKid,
  listCustomers,
  listKids,
} from '../controllers/crm.controller';

export const crmRouter = Router();
crmRouter.post('/customers', createCustomer);
crmRouter.get('/customers', listCustomers);
crmRouter.post('/customers/:phone/interactions', addInteraction);
crmRouter.post('/kids', createKid);
crmRouter.get('/kids', listKids);
