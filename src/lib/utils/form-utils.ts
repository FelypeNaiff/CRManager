/**
 * Nãormalizes an object so that it can be safely compared using JSON.stringify
 * This solves issues with:
 * - undefined values (omitted in JSON.stringify)
 * - null vs empty string
 * - Date objects vs ISO strings
 * - Decimal/Prisma Decimal vs numbers/strings
 */
export function normalizeFormDataForComparison(data: any): any {
  if (data === null || data === undefined) {
    return '';
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Prisma Decimal or similar objects that have a toString method
  if (typeof data === 'object' && typeof data.toString === 'function' && Object.keys(data).includes('d') && Object.keys(data).includes('e')) {
      return data.toString();
  }

  if (Array.isArray(data)) {
    return data.map(normalizeFormDataForComparison);
  }

  if (typeof data === 'object') {
    const normalized: Record<string, any> = {};
    for (const key of Object.keys(data).sort()) { // Sort keys to ensure stable stringify
      const val = data[key];
      // Treat null, undefined, and empty string as equivalent for forms
      if (val === null || val === undefined || val === '') {
        normalized[key] = '';
      } else {
        // Convert numbers to strings for safer comparison across form inputs (which are often strings)
        // or just rely on normalizeFormDataForComparison for deeper normalization
        normalized[key] = normalizeFormDataForComparison(val);
      }
    }
    return normalized;
  }

  // Convert numbers to strings to avoid '1' !== 1 issues in form state vs db state
  if (typeof data === 'number') {
    return String(data);
  }

  return data;
}

/**
 * Checks if two form data objects are different
 */
export function isFormDirty(currentData: any, initialData: any): boolean {
  if (!currentData || !initialData) return false;
  
  const normalizedCurrent = JSON.stringify(normalizeFormDataForComparison(currentData));
  const normalizedInitial = JSON.stringify(normalizeFormDataForComparison(initialData));
  
  return normalizedCurrent !== normalizedInitial;
}
