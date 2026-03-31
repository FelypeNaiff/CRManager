import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload {
  userId: string;
  lojaId: string;
  role: 'OWNER' | 'MANAGER' | 'SELLER' | 'FINANCE' | 'MARKETING' | 'CUSTOMER';
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ message: 'Token não informado.' });

  try {
    req.auth = jwt.verify(token, env.jwtSecret) as AuthPayload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido.' });
  }
};

export const authorize = (allowedRoles: AuthPayload['role'][]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ message: 'Não autenticado.' });
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'Sem permissão.' });
    }
    return next();
  };
};
