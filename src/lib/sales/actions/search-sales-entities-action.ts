'use server';
import { serializePrisma } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission } from '@/lib/auth/permissions';
import { tenantListWhere } from '../sales-tenant-security';

async function requireSalesSearchContext() {
  return requireAnyPermission([
    { module: 'PDV', action: 'VIEW' },
    { module: 'VENDAS', action: 'VIEW' },
  ]);
}

export async function searchVariantsAction(_companyId: string, query: string) {
  try {
    const auth = await requireSalesSearchContext();
    const companyId = auth.companyId;
    const q = query.trim();
    if (!q) return { success: true, variants: [] };

    // Carregar configurações operacionais da empresa
    const settings = await prisma.operationalSettings.findUnique({
      where: { companyId }
    });
    const allowNegativeStock = settings?.allowNegativeStock ?? false;

    const whereClause: any = {
      ...tenantListWhere(companyId),
      isActive: true,
      product: { isActive: true },
      OR: [
        { sku: { equals: q, mode: "insensitive" } },
        { barcode: { equals: q } },
        { name: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
        { product: { internalCode: { equals: q, mode: "insensitive" } } }
      ]
    };

    if (!allowNegativeStock) {
      whereClause.availableStock = { gt: 0 };
    }

    const variants = await prisma.productVariant.findMany({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        costPrice: true,
        salePrice: true,
        availableStock: true,
        productId: true,
        product: { select: { name: true, imageUrl: true, internalCode: true } }
      },
      take: 20
    });
    return { success: true, variants: serializePrisma(variants) };
  } catch {
    return { success: false, error: 'Não foi possível buscar produtos.' };
  }
}

export async function searchCustomersAction(_companyId: string, query: string) {
  try {
    const auth = await requireSalesSearchContext();
    const customers = await prisma.customer.findMany({
      where: {
        ...tenantListWhere(auth.companyId),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { cpf: { contains: query, mode: "insensitive" } }
        ]
      },
      include: {
        wallet: true
      },
      take: 20
    });
    return { success: true, customers: serializePrisma(customers) };
  } catch {
    return { success: false, error: 'Não foi possível buscar clientes.' };
  }
}
