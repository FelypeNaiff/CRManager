import type { ProfileSelectorPayload } from './profile-selector';

const PROFILE_SELECTOR_VERSION = 1;
const PROFILE_SELECTOR_MAX_AGE_SECONDS = 60 * 60;

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function verifyProfileSelectorAtEdge(
  token: string,
  secret: string,
  expectedAuthUserId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  try {
    if (!token || !secret || !expectedAuthUserId) return false;
    const [encodedPayload, encodedSignature, extra] = token.split('.');
    if (!encodedPayload || !encodedSignature || extra) return false;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const validSignature = await crypto.subtle.verify(
      'HMAC', key, decodeBase64Url(encodedSignature).buffer as ArrayBuffer,
      new TextEncoder().encode(encodedPayload)
    );
    if (!validSignature) return false;
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload))
    ) as ProfileSelectorPayload;
    return payload.v === PROFILE_SELECTOR_VERSION
      && payload.authUserId === expectedAuthUserId
      && typeof payload.profileId === 'string'
      && payload.profileId.length > 0
      && payload.issuedAt <= nowSeconds
      && payload.expiresAt > nowSeconds
      && payload.expiresAt - payload.issuedAt === PROFILE_SELECTOR_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}
