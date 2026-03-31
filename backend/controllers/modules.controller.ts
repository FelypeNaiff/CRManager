import crypto from 'crypto';
import { Request, Response } from 'express';

const store = new Map<string, Record<string, any[]>>();

const getBucket = (lojaId: string, moduleName: string) => {
  const loja = store.get(lojaId) ?? {};
  if (!loja[moduleName]) loja[moduleName] = [];
  store.set(lojaId, loja);
  return loja[moduleName];
};

export const createModuleItem = (moduleName: string) => (req: Request, res: Response) => {
  const lojaId = req.headers['x-loja-id'] as string;
  const item = { id: crypto.randomUUID(), loja_id: lojaId, ...req.body };
  getBucket(lojaId, moduleName).push(item);
  res.status(201).json(item);
};

export const listModuleItems = (moduleName: string) => (req: Request, res: Response) => {
  const lojaId = req.headers['x-loja-id'] as string;
  res.json(getBucket(lojaId, moduleName));
};
