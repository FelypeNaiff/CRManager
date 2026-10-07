import { z } from 'zod';

export const QuickCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(150),
  phone: z.string().trim().min(8, 'Informe um telefone válido.').max(30),
  children: z.array(z.object({
    name: z.string().trim().min(2, 'Informe o nome da criança.').max(150),
    age: z.number().int().min(0, 'Idade inválida.').max(25, 'Idade inválida.'),
  })).min(1, 'Informe pelo menos uma criança.').max(10),
});

export type QuickCustomerInput = z.infer<typeof QuickCustomerSchema>;
