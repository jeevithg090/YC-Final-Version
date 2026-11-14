import { authErrorMessage, isValidEmail } from '../authErrors';

describe('authErrorMessage', () => {
  it('maps known Firebase codes to friendly copy', () => {
    expect(authErrorMessage({ code: 'auth/email-already-in-use' }, 'signup')).toMatch(/already exists/);
    expect(authErrorMessage({ code: 'auth/too-many-requests' }, 'login')).toMatch(/Too many attempts/);
  });

  it('does not reveal which credential was wrong', () => {
    const invalid = authErrorMessage({ code: 'auth/invalid-credential' }, 'login');
    expect(authErrorMessage({ code: 'auth/wrong-password' }, 'login')).toBe(invalid);
    expect(authErrorMessage({ code: 'auth/user-not-found' }, 'login')).toBe(invalid);
  });

  it('treats an unknown account as success for password resets', () => {
    expect(authErrorMessage({ code: 'auth/user-not-found' }, 'reset')).toBe('');
  });

  it('falls back to an action-specific message', () => {
    expect(authErrorMessage(new Error('boom'), 'login')).toMatch(/log you in/);
    expect(authErrorMessage(null, 'signup')).toMatch(/create your account/);
    expect(authErrorMessage({ code: 'auth/unknown' }, 'reset')).toMatch(/reset email/);
  });
});

describe('isValidEmail', () => {
  it.each(['student@university.edu', ' a.b+c@d.co ', 'x@y.in'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'student', 'student@', '@uni.edu', 'a b@c.d', 'a@b'])('rejects %p', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
