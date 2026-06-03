import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash an authorization PIN
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || pin.length < 4 || pin.length > 8) {
    throw new Error('O PIN deve conter entre 4 e 8 caracteres.');
  }
  return await bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Validate a PIN against its hash
 */
export async function validatePin(pin: string, hash: string): Promise<boolean> {
  if (!pin || !hash) return false;
  return await bcrypt.compare(pin, hash);
}

/**
 * Generates a random temporary PIN (6 digits)
 */
export function generateTemporaryPin(): string {
  // Generates a 6-digit random number
  const min = 100000;
  const max = 999999;
  const tempPin = Math.floor(Math.random() * (max - min + 1)) + min;
  return tempPin.toString();
}

/**
 * Resets a PIN by returning a generated temporary PIN and its hash
 */
export async function resetPin(): Promise<{ tempPin: string; hash: string }> {
  const tempPin = generateTemporaryPin();
  const hash = await hashPin(tempPin);
  return { tempPin, hash };
}
