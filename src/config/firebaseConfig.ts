import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase settings that must be present for the app to talk to a project.
 * `measurementId` is optional (Analytics only).
 */
export const REQUIRED_FIREBASE_ENV_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

export type FirebaseEnv = Partial<Record<string, string | undefined>>;

export interface FirebaseConfigResult {
  /** Options to pass to `initializeApp`. Always safe to initialise with. */
  options: FirebaseOptions;
  /** Required variables that are missing or blank. Empty when fully configured. */
  missing: string[];
  isConfigured: boolean;
}

/**
 * Placeholder values used when configuration is missing, so that SDK modules
 * (notably Realtime Database, which throws on an unparsable URL) can still be
 * initialised. The UI shows a setup screen instead of making requests.
 */
const PLACEHOLDER_OPTIONS: FirebaseOptions = {
  apiKey: 'missing-api-key',
  authDomain: 'unconfigured.firebaseapp.com',
  databaseURL: 'https://unconfigured-default-rtdb.firebaseio.com',
  projectId: 'unconfigured',
  storageBucket: 'unconfigured.appspot.com',
  messagingSenderId: '0',
  appId: '0:0:web:0',
};

const clean = (value: string | undefined): string => (value ?? '').trim();

/**
 * Builds Firebase options from `EXPO_PUBLIC_*` variables.
 *
 * Note: Expo inlines `process.env.EXPO_PUBLIC_*` only for static property
 * access, so callers must pass an object built with explicit lookups.
 */
export function readFirebaseConfig(env: FirebaseEnv): FirebaseConfigResult {
  const missing = REQUIRED_FIREBASE_ENV_VARS.filter((name) => clean(env[name]) === '');

  if (missing.length > 0) {
    return { options: PLACEHOLDER_OPTIONS, missing, isConfigured: false };
  }

  const measurementId = clean(env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID);
  return {
    options: {
      apiKey: clean(env.EXPO_PUBLIC_FIREBASE_API_KEY),
      authDomain: clean(env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
      databaseURL: clean(env.EXPO_PUBLIC_FIREBASE_DATABASE_URL),
      projectId: clean(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      storageBucket: clean(env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
      messagingSenderId: clean(env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
      appId: clean(env.EXPO_PUBLIC_FIREBASE_APP_ID),
      ...(measurementId ? { measurementId } : {}),
    },
    missing: [],
    isConfigured: true,
  };
}
