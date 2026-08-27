"use server";

import { revalidatePath } from "next/cache";
import { CreateSellerInput, UpdateSellerInput, createSellerSchema, updateSellerSchema } from "./sellers-schemas";
import { sellersService } from "./sellers-service";
import { requirePermission } from "../auth/permissions";
import { publicActionError } from "../auth/public-action-error";
import { SELLER_PERMISSIONS } from './seller-security';
import { z } from "zod";

type SellerActionInput = Omit<CreateSellerInput, "status"> & { status: string };
type SellerUpdateActionInput = Omit<UpdateSellerInput, "status"> & { status?: string };

export async function createSellerAction(data: SellerActionInput) {
  try {
    const session = await requirePermission(SELLER_PERMISSIONS.create.module, SELLER_PERMISSIONS.create.action);

    const validatedData = createSellerSchema.parse(data);

    const result = await sellersService.createSeller(validatedData, session.companyId);
    
    revalidatePath("/comercial/vendedores");
    revalidatePath("/pdv");
    return { success: true, seller: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Dados inválidos: " + error.errors.map(e => e.message).join(", ") };
    }
    return { error: publicActionError(error, "Erro ao criar vendedor") };
  }
}

export async function updateSellerAction(data: SellerUpdateActionInput) {
  try {
    const session = await requirePermission(SELLER_PERMISSIONS.update.module, SELLER_PERMISSIONS.update.action);

    const validatedData = updateSellerSchema.parse(data);

    const result = await sellersService.updateSeller(validatedData, session.companyId);
    
    revalidatePath("/comercial/vendedores");
    revalidatePath("/pdv");
    return { success: true, seller: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Dados inválidos" };
    }
    return { error: publicActionError(error, "Erro ao atualizar vendedor") };
  }
}

export async function deleteSellerAction(id: string) {
  try {
    const session = await requirePermission(SELLER_PERMISSIONS.disable.module, SELLER_PERMISSIONS.disable.action);

    await sellersService.deleteSeller(id, session.companyId);
    revalidatePath("/comercial/vendedores");
    revalidatePath("/pdv");
    return { success: true };
  } catch (error) {
    return { error: publicActionError(error, "Erro ao desativar vendedor") };
  }
}
