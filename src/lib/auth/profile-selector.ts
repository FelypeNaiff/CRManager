import { createHmac, timingSafeEqual } from 'node:crypto';

export const PROFILE_SESSION_COOKIE = '@crmanager:activeProfileSession';
export const PROFILE_SELECTOR_VERSION = 1 as const;
export const PROFILE_SELECTOR_MAX_AGE_SECONDS = 60 * 60;

export interface ProfileSelectorPayload {
  v: typeof PROFILE_SELECTOR_VERSION;
  profileId: string;
  authUserId: string;
  issuedAt: number;
  expiresAt: number;
}

export class ProfileSelectorError extends Error {
  constructor() {
    super('Seletor de perfil inválido.');
    this.name = 'ProfileSelectorError';
  }
}

export function getProfileSessionSecret(): string {
  const secret = process.env.NEEX_PROFILE_SESSION_SECRET;
  if (!secret) throw new ProfileSelectorError();
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(encodedPayload).digest();
}

export function createProfileSelector(
  input: { profileId: string; authUserId: string },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  if (!secret || !input.profileId || !input.authUserId) throw new ProfileSelectorError();

  const payload: ProfileSelectorPayload = {
    v: PROFILE_SELECTOR_VERSION,
    profileId: input.profileId,
    authUserId: input.authUserId,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + PROFILE_SELECTOR_MAX_AGE_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret).toString('base64url')}`;
}

export function verifyProfileSelector(
  token: string,
  secret: string,
  expectedAuthUserId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): ProfileSelectorPayload {
  if (!secret || !token || !expectedAuthUserId) throw new ProfileSelectorError();

  const parts = token.split('.');
  if (parts.length !== 2) throw new ProfileSelectorError();
  const [encodedPayload, encodedSignature] = parts;

  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    throw new ProfileSelectorError();
  }
  const expectedSignature = sign(encodedPayload, secret);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new ProfileSelectorError();
  }

  let payload: ProfileSelectorPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new ProfileSelectorError();
  }

  if (
    payload.v !== PROFILE_SELECTOR_VERSION ||
    typeof payload.profileId !== 'string' ||
    typeof payload.authUserId !== 'string' ||
    typeof payload.issuedAt !== 'number' ||
    typeof payload.expiresAt !== 'number' ||
    payload.authUserId !== expectedAuthUserId ||
    payload.issuedAt > nowSeconds ||
    payload.expiresAt <= nowSeconds ||
    payload.expiresAt - payload.issuedAt !== PROFILE_SELECTOR_MAX_AGE_SECONDS
  ) {
    throw new ProfileSelectorError();
  }

  return Object.freeze(payload);
}
