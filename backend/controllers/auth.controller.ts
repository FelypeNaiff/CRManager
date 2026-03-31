import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';

const loginSchema = z.object({
  phone: z.string().min(10),
  otp: z.string().min(4),
  lojaId: z.string().uuid(),
  role: z.enum(['OWNER', 'MANAGER', 'SELLER', 'FINANCE', 'MARKETING', 'CUSTOMER']),
});

export const loginController = (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  const token = jwt.sign(
    { userId: body.phone, lojaId: body.lojaId, role: body.role },
    env.jwtSecret,
    { expiresIn: '12h' },
  );

  return res.json({ token });
};
