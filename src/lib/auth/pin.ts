import bcrypt from 'bcryptjs';

/**
 * Hashes a plaintext PIN (e.g. "1234") using bcrypt.
 * @param pin 4-digit PIN string
 * @returns Promise<string> the hashed PIN
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

/**
 * Compares a plaintext PIN against a stored bcrypt hash.
 * @param pin 4-digit PIN string
 * @param hash stored bcrypt hash string
 * @returns Promise<boolean> true if it matches, false otherwise
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pin, hash);
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
}
