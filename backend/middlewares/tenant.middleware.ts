import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const tenantGuard = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const lojaId = req.headers['x-loja-id'] as string | undefined;

  if (!lojaId) {
    return res.status(400).json({ message: 'x-loja-id é obrigatório.' });
  }

  if (req.auth && req.auth.lojaId !== lojaId) {
    return res.status(403).json({ message: 'Acesso cruzado entre lojas bloqueado.' });
  }

  req.headers['x-loja-id'] = lojaId;
  return next();
};
