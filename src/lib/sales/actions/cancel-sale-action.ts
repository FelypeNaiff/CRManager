'use server';

import { revalidatePath, revalidateTag } from "next/cache";
import { salesService } from "../sales-service";
import { CancelSaleInput } from "../sales-schemas";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { createCancelSaleAction } from './sales-action-handlers';

const handler = createCancelSaleAction({ authorize: requireAnyPermission, service: salesService, revalidateTag, revalidatePath });
export async function cancelSaleAction(data: CancelSaleInput) { return handler(data); }
