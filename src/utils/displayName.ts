/** Best display name from a Firebase user's profile fields, falling back to the email's local part. */
export function resolveDisplayName(displayName: string | null | undefined, email: string | null | undefined): string {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  const localPart = email?.split('@')[0]?.trim();
  if (localPart) return localPart;
  return 'Student';
}
