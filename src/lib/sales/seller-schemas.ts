import { z } from "zod";

export const createSellerSchema = z.object({
  userId: z.string(),
  isSeller: z.boolean(),
  sellerCode: z.string().optional(),
  commissionRate: z.number().min(0).max(100),
  maxDiscountPercentage: z.number().min(0).max(100).optional()
});

export const updateSellerSchema = createSellerSchema;

export const createSellerGoalSchema = z.object({
  userId: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  targetAmount: z.number().min(0)
});

export const updateSellerGoalSchema = z.object({
  goalId: z.string(),
  targetAmount: z.number().min(0)
});

export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
export type CreateSellerGoalInput = z.infer<typeof createSellerGoalSchema>;
export type UpdateSellerGoalInput = z.infer<typeof updateSellerGoalSchema>;
