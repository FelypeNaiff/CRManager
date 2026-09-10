import {
  createProfileSelector,
  getProfileSessionSecret,
  PROFILE_SELECTOR_MAX_AGE_SECONDS,
} from './profile-selector';

export function createProfileSession(profileId: string, authUserId: string): string {
  return createProfileSelector(
    { profileId, authUserId },
    getProfileSessionSecret()
  );
}

export function getProfileSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: PROFILE_SELECTOR_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
  };
}
