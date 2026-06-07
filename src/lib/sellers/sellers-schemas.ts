import { z } from "zod";

export const createSellerSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  commissionRate: z.number().min(0, "A comissão não pode ser negativa").optional().default(0),
  goal: z.number().min(0).optional(),
  notes: z.string().optional()
});

export type CreateSellerInput = z.infer<typeof createSellerSchema>;

export const updateSellerSchema = createSellerSchema.partial().extend({
  id: z.string().uuid()
});

export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
