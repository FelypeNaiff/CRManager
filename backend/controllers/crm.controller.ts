import { Request, Response } from 'express';
import { z } from 'zod';

const customers: any[] = [];
const kids: any[] = [];

const customerSchema = z.object({
  loja_id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  segment: z.string().default('NOVO'),
});

const kidSchema = z.object({
  loja_id: z.string().uuid(),
  customer_phone: z.string(),
  name: z.string(),
  birth_date: z.string(),
});

const suggestSize = (age: number) => {
  if (age <= 1) return 'RN/P';
  if (age <= 3) return '2-3';
  if (age <= 6) return '4-6';
  return '8+';
};

export const createCustomer = (req: Request, res: Response) => {
  const customer = customerSchema.parse(req.body);
  customers.push({ ...customer, interactions: [] });
  res.status(201).json(customer);
};

export const listCustomers = (req: Request, res: Response) => {
  const lojaId = req.headers['x-loja-id'];
  res.json(customers.filter((c) => c.loja_id === lojaId));
};

export const addInteraction = (req: Request, res: Response) => {
  const { phone } = req.params;
  const customer = customers.find((c) => c.phone === phone);
  if (!customer) return res.status(404).json({ message: 'Cliente não encontrado.' });

  customer.interactions.push({ ...req.body, created_at: new Date().toISOString() });
  return res.status(201).json(customer);
};

export const createKid = (req: Request, res: Response) => {
  const kid = kidSchema.parse(req.body);
  const birthDate = new Date(kid.birth_date);
  const age = Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const currentSize = suggestSize(age);
  const nextSize = suggestSize(age + 1);

  const entity = { ...kid, age, currentSize, nextSize };
  kids.push(entity);
  return res.status(201).json(entity);
};

export const listKids = (req: Request, res: Response) => {
  const lojaId = req.headers['x-loja-id'];
  res.json(kids.filter((k) => k.loja_id === lojaId));
};
