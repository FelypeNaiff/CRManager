import { Prisma } from '@prisma/client';

/**
 * Sanitiza e prepara uma string de busca (ex: remover espaços múltiplos).
 */
export function sanitizeSearchQuery(query: string | undefined): string {
  if (!query) return "";
  return query.trim().replace(/\s+/g, ' ');
}

/**
 * Cria cláusula OR robusta para buscar produtos por código, nome, sku ou barcode.
 */
export function buildProductSearchWhere(searchStr: string): Prisma.ProductWhereInput {
  const q = sanitizeSearchQuery(searchStr);
  if (!q) return {};

  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { internalCode: { equals: q } }, // Exact match para performance
      { variants: { some: { sku: { equals: q } } } },
      { variants: { some: { barcode: { equals: q } } } }
    ]
  };
}
