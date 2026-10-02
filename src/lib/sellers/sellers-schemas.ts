import { z } from "zod";

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalCpf = optionalText.refine(value => !value || isValidCpf(value), "CPF inválido");

export const createSellerSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  nickname: optionalText,
  phone: optionalText,
  mobile: optionalText,
  cpf: optionalCpf,
  rg: optionalText,
  birthDate: z.coerce.date().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  userId: z.string().uuid().optional().nullable(),
  cep: optionalText,
  street: optionalText,
  addressNumber: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: z.string().trim().max(2).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  commissionRate: z.number().min(0, "A comissão não pode ser negativa").max(100).optional().default(0),
  commissionReleasePolicy: z.enum(["ON_FINANCIAL_OBLIGATION", "ON_FIRST_INSTALLMENT_RECEIVED", "ON_FULL_SETTLEMENT", "PROPORTIONAL_TO_RECEIPTS"]).optional().nullable(),
  goal: z.number().min(0).optional(),
  notes: z.string().optional()
});

export type CreateSellerInput = z.infer<typeof createSellerSchema>;

export const updateSellerSchema = createSellerSchema.partial().extend({
  id: z.string().uuid()
});

export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
