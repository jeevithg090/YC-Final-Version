import { auth } from './firebase';

export interface CurrentUserIdentity {
  /** Firebase Auth UID, or `null` when nobody is signed in. */
  id: string | null;
  /** Best available display name for the signed-in user. */
  name: string;
  email: string | null;
  phoneNumber: string | null;
}

/**
 * Derives a display name from a Firebase user's profile fields.
 * Exported separately so it can be unit-tested without Firebase.
 */
export function resolveDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  const localPart = email?.split('@')[0]?.trim();
  if (localPart) return localPart;
  return 'Student';
}

/** Snapshot of the currently signed-in user, safe to call when signed out. */
export function getCurrentUserIdentity(): CurrentUserIdentity {
  const user = auth.currentUser;
  return {
    id: user?.uid ?? null,
    name: resolveDisplayName(user?.displayName, user?.email),
    email: user?.email ?? null,
    phoneNumber: user?.phoneNumber ?? null,
  };
}
