'use server';
import { serializePrisma } from '@/lib/serialize';

import { salesService } from "../sales-service";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { createListSalesAction, type ListSalesFilters } from './sales-action-handlers';

const handler = createListSalesAction({ authorize: requireAnyPermission, service: salesService });
export async function listSalesAction(companyId: string, filters?: ListSalesFilters) { return handler(companyId, filters); }
