export function serializePrisma<T>(data: T): T {
  if (data === null || data === undefined) return data;
  
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();

      if (
        value &&
        typeof value === 'object' &&
        typeof value.toNumber === 'function' &&
        value.constructor?.name === 'Decimal'
      ) {
        return value.toNumber();
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      return value;
    })
  );
}
