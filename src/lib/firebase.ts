/**
 * Firebase settings. The app runs on Firebase when it is built with
 *   VITE_FIREBASE_CONFIG='{"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","appId":"…"}'
 * (the web-app config from the Firebase console — public, not a secret).
 * VITE_FIREBASE_EMULATOR=1 points it at the local emulators instead (tests).
 *
 * This module has no Firebase imports, so builds without Firebase stay small;
 * the SDK is only loaded (lazily) by firebaseSync.ts.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

function readConfig(): FirebaseWebConfig | null {
  const raw = (import.meta.env?.VITE_FIREBASE_CONFIG as string | undefined) ?? '';
  if (!raw.trim()) return null;
  try {
    // Accept the console snippet with or without quoted keys.
    const json = raw.trim().replace(/([{,]\s*)([A-Za-z]+)\s*:/g, '$1"$2":').replace(/'/g, '"');
    const cfg = JSON.parse(json) as FirebaseWebConfig;
    return cfg.apiKey && cfg.projectId ? cfg : null;
  } catch {
    console.warn('[bazaar] VITE_FIREBASE_CONFIG is not valid JSON — running without Firebase');
    return null;
  }
}

export const firebaseConfig = readConfig();
export const firebaseEnabled = firebaseConfig !== null;
export const useEmulators =
  firebaseEnabled && String(import.meta.env?.VITE_FIREBASE_EMULATOR ?? '') === '1';
export const FUNCTIONS_REGION = 'asia-south1';
