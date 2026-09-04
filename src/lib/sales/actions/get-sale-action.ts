'use server';
import { serializePrisma } from '@/lib/serialize';

import { salesService } from "../sales-service";
import { requirePermission } from "@/lib/auth/permissions";
import { createGetSaleAction } from './sales-action-handlers';

const handler = createGetSaleAction({ authorize: requirePermission, service: salesService });
export async function getSaleAction(saleId: string) { return handler(saleId); }
