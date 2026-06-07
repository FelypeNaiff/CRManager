import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Nãormaliza um objeto para comparação segura, tratando Dates, Decimals e campos undefined.
 * Remove nulls/undefineds, converte Date para string ISO e numbers/decimals para string.
 */
export function normalizeFormDataForComparison(data: any): any {
  if (data === null || data === undefined) return null;
  if (data instanceof Date) return data.toISOString();
  if (typeof data === 'object') {
    if (typeof data.getMonth === 'function') return data.toISOString(); // fallback para outras libs de Date
    if (data.toNumber && typeof data.toNumber === 'function') return data.toString(); // Prisma.Decimal
    if (Array.isArray(data)) {
      return data.map(normalizeFormDataForComparison);
    }
    const normalized: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      const val = normalizeFormDataForComparison(data[key]);
      if (val !== null && val !== undefined && val !== "") {
        normalized[key] = val;
      }
    }
    return normalized;
  }
  if (typeof data === 'number') return data.toString();
  return data;
}
