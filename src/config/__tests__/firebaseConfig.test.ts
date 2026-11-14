import { readFirebaseConfig, REQUIRED_FIREBASE_ENV_VARS } from '../firebaseConfig';

const completeEnv = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: 'https://demo-default-rtdb.firebaseio.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
};

describe('readFirebaseConfig', () => {
  it('builds Firebase options from a complete environment', () => {
    const result = readFirebaseConfig({ ...completeEnv, EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: ' G-TEST ' });
    expect(result.isConfigured).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.options).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'demo.firebaseapp.com',
      databaseURL: 'https://demo-default-rtdb.firebaseio.com',
      projectId: 'demo',
      storageBucket: 'demo.appspot.com',
      messagingSenderId: '123',
      appId: '1:123:web:abc',
      measurementId: 'G-TEST',
    });
  });

  it('omits measurementId when it is not set', () => {
    expect(readFirebaseConfig(completeEnv).options).not.toHaveProperty('measurementId');
  });

  it('lists every missing or blank required variable', () => {
    const result = readFirebaseConfig({
      ...completeEnv,
      EXPO_PUBLIC_FIREBASE_API_KEY: '   ',
      EXPO_PUBLIC_FIREBASE_APP_ID: undefined,
    });
    expect(result.isConfigured).toBe(false);
    expect(result.missing).toEqual(['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_APP_ID']);
  });

  it('returns placeholder options that SDK initialisation can parse when unconfigured', () => {
    const result = readFirebaseConfig({});
    expect(result.missing).toEqual([...REQUIRED_FIREBASE_ENV_VARS]);
    expect(result.options.databaseURL).toMatch(/^https:\/\/.+\.firebaseio\.com$/);
    expect(result.options.apiKey).toBeTruthy();
  });
});
