'use server';

import { requireAnyPermission } from "@/lib/auth/permissions";
import { salesService } from "../sales-service";
import { CreateSaleInput } from "../sales-schemas";
import { revalidateTag } from "next/cache";
import { createCreateSaleAction } from './sales-action-handlers';

const handler = createCreateSaleAction({ authorize: requireAnyPermission, service: salesService, revalidate: revalidateTag });
export async function createSaleAction(data: CreateSaleInput) { return handler(data); }
