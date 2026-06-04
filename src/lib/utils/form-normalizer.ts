/**
 * Utility functions to safely normalize form inputs before sending them to Server Actions.
 * These functions prevent NaN, Infinity, and Invalid Date from causing serialization crashes.
 * Empty strings are safely converted to null.
 * Valid 0 (zero) values are preserved.
 */

/**
 * Safely converts a value to a Number.
 * Returns null for empty strings, undefined, null, NaN, or Infinity.
 * Preserves 0.
 */
export function safeNumber(value: any): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Safely parses an Integer.
 * Returns null for empty strings, undefined, null, NaN, or Infinity.
 * Preserves 0.
 */
export function safeInteger(value: any): number | null {
  if (value === "" || value === null || value === undefined) return null;
  // Convert to string first to handle edge cases in parseInt
  const num = parseInt(String(value), 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * Safely parses a Date.
 * Returns null for empty strings, undefined, null, or Invalid Dates.
 */
export function safeDate(value: any): Date | null {
  if (value === "" || value === null || value === undefined) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Safely normalizes a string.
 * Trims whitespace and returns null if the resulting string is empty.
 */
export function safeString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}
