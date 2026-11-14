import { auth } from './firebase';
import { resolveDisplayName } from '../utils/displayName';

export { resolveDisplayName };

export interface CurrentUserIdentity {
  /** Firebase Auth UID, or `null` when nobody is signed in. */
  id: string | null;
  /** Best available display name for the signed-in user. */
  name: string;
  email: string | null;
  phoneNumber: string | null;
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
