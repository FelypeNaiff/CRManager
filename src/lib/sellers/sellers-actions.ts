"use server";

import { revalidatePath } from "next/cache";
import { CreateSellerInput, UpdateSellerInput, createSellerSchema, updateSellerSchema } from "./sellers-schemas";
import { sellersService } from "./sellers-service";
import { getActiveProfileSession } from "../auth/actions";
import { z } from "zod";

export async function createSellerAction(data: CreateSellerInput) {
  try {
    const session = await getActiveProfileSession();
    if (!session?.companyId) {
      return { error: "Não autenticado ou sem empresa selecionada" };
    }

    const validatedData = createSellerSchema.parse(data);

    const result = await sellersService.createSeller(validatedData, session.companyId);
    
    revalidatePath("/comercial/vendedores");
    revalidatePath("/pdv");
    return { success: true, seller: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Dados inválidos: " + error.errors.map(e => e.message).join(", ") };
    }
    return { error: error instanceof Error ? error.message : "Erro ao criar vendedor" };
  }
}

export async function updateSellerAction(data: UpdateSellerInput) {
  try {
    const session = await getActiveProfileSession();
    if (!session?.companyId) {
      return { error: "Não autenticado" };
    }

    const validatedData = updateSellerSchema.parse(data);

    const result = await sellersService.updateSeller(validatedData, session.companyId);
    
    revalidatePath("/comercial/vendedores");
    revalidatePath("/pdv");
    return { success: true, seller: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Dados inválidos" };
    }
    return { error: error instanceof Error ? error.message : "Erro ao atualizar" };
  }
}

export async function deleteSellerAction(id: string) {
  try {
    const session = await getActiveProfileSession();
    if (!session?.companyId) {
      return { error: "Não autenticado" };
    }

    await sellersService.deleteSeller(id, session.companyId);
    revalidatePath("/comercial/vendedores");
    revalidatePath("/pdv");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao excluir" };
  }
}
