/**
 * Friendly copy for Firebase Auth error codes.
 *
 * Firebase projects with email-enumeration protection (the default since 2023)
 * report a wrong email *or* password as `auth/invalid-credential`, so the
 * message for that case deliberately does not say which one was wrong.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match an account. Check them and try again.',
  'auth/wrong-password': 'That email and password don’t match an account. Check them and try again.',
  'auth/user-not-found': 'That email and password don’t match an account. Check them and try again.',
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact support if you think this is a mistake.',
  'auth/email-already-in-use': 'An account already exists for this email. Try logging in instead.',
  'auth/weak-password': 'Choose a stronger password: at least 6 characters, ideally with numbers and symbols.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute, then try again.',
  'auth/network-request-failed': 'Can’t reach the server. Check your internet connection and try again.',
  'auth/missing-email': 'Enter your email address.',
};

export type AuthAction = 'login' | 'signup' | 'reset';

const FALLBACK: Record<AuthAction, string> = {
  login: 'We couldn’t log you in. Please try again.',
  signup: 'We couldn’t create your account. Please try again.',
  reset: 'We couldn’t send the reset email. Please try again.',
};

/** Returns a user-facing message for an error thrown by Firebase Auth. */
export function authErrorMessage(error: unknown, action: AuthAction): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  // For password resets, don't reveal whether an account exists.
  if (action === 'reset' && code === 'auth/user-not-found') return '';
  return MESSAGES[code] ?? FALLBACK[action];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lenient email check used for client-side form validation. */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
