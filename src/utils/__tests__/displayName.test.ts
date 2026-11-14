import { resolveDisplayName } from '../displayName';

describe('resolveDisplayName', () => {
  it('prefers the profile display name', () => {
    expect(resolveDisplayName('  Asha Rao ', 'asha@example.edu')).toBe('Asha Rao');
  });

  it('falls back to the local part of the email', () => {
    expect(resolveDisplayName('', 'asha.rao@example.edu')).toBe('asha.rao');
    expect(resolveDisplayName(null, 'asha@example.edu')).toBe('asha');
  });

  it('uses a generic name when nothing is available', () => {
    expect(resolveDisplayName(undefined, undefined)).toBe('Student');
    expect(resolveDisplayName('   ', '@example.edu')).toBe('Student');
  });
});
