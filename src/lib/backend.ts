/**
 * Picks the backend the app talks to:
 *   - Firebase when built with VITE_FIREBASE_CONFIG (SDK loaded lazily),
 *   - the self-hosted Bazaar API when built with VITE_API_URL,
 *   - otherwise the offline demo (every remote call is a no-op).
 * The store and pages import from here, never from sync.ts / firebaseSync.ts directly.
 */
import { api, apiEnabled, type AdminReport, type AdminStats, type ResolveAction } from './api';
import { firebaseEnabled } from './firebase';
import * as apiSync from './sync';
import type { Ad, Message } from './types';

type FirebaseModule = typeof import('./firebaseSync');
let fbMod: FirebaseModule | null = null;
let fbLoading: Promise<FirebaseModule> | null = null;

export const backend: 'firebase' | 'api' | 'demo' = firebaseEnabled ? 'firebase' : apiEnabled ? 'api' : 'demo';
export const backendEnabled = backend !== 'demo';

export function loadFirebase(): Promise<FirebaseModule> {
  if (!firebaseEnabled) return Promise.reject(new Error('Firebase is not configured'));
  fbLoading ??= import('./firebaseSync').then((m) => (fbMod = m));
  return fbLoading;
}

interface Remote {
  readonly enabled: boolean;
  chatIdFor(adId: string): string | undefined;
  logout(): void;
  setArea(area: string): void;
  favorite(id: string, on: boolean): void;
  view(id: string): void;
  createAd(ad: Ad): void;
  updateAd(id: string, patch: Partial<Ad>): void;
  deleteAd(id: string): void;
  boostAd(id: string): void;
  dropPrice(id: string, price: number): void;
  startChat(chatId: string, adId: string): void;
  sendMessage(chatId: string, msg: Message): void;
  markChatRead(chatId: string): void;
  markNotificationsRead(id?: string): void;
  addReview(localId: string, sellerId: string, rating: number, text: string): void;
  report(targetType: 'ad' | 'seller', targetId: string, reason: string): void;
  setBlocked(sellerId: string, on: boolean): void;
  resetDemo(): void;
}

const target = (): Partial<Remote> | null =>
  backend === 'firebase' ? (fbMod?.remote ?? null) : backend === 'api' ? apiSync.remote : null;

/** Same calls in every mode; until Firebase has loaded (nobody signed in yet) they're no-ops. */
export const remote = new Proxy({} as Remote, {
  get(_t, key: string) {
    if (key === 'enabled') return target()?.enabled ?? false;
    return (...args: unknown[]) => {
      const fn = target()?.[key as keyof Remote];
      return typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown)(...args) : undefined;
    };
  },
});

export function startSync() {
  if (backend === 'api') apiSync.startSync();
  if (backend === 'firebase') {
    loadFirebase()
      .then((m) => m.startSync())
      .catch((e) => console.warn('[bazaar] Firebase failed to start', e));
  }
}

export async function payForBoost(adId: string): Promise<'paid' | 'cancelled'> {
  return backend === 'firebase' ? (await loadFirebase()).payForBoost(adId) : apiSync.payForBoost(adId);
}

export const adminApi = {
  async stats(): Promise<AdminStats> {
    return backend === 'firebase' ? (await loadFirebase()).adminApi.stats() : api.adminStats();
  },
  async reports(status: 'open' | 'resolved'): Promise<{ reports: AdminReport[] }> {
    return backend === 'firebase' ? (await loadFirebase()).adminApi.reports(status) : api.adminReports(status);
  },
  async resolve(id: string, action: ResolveAction): Promise<unknown> {
    return backend === 'firebase'
      ? (await loadFirebase()).adminApi.resolve(id, action)
      : api.resolveReport(id, action);
  },
  async unban(id: string): Promise<unknown> {
    return backend === 'firebase' ? (await loadFirebase()).adminApi.unban(id) : api.unbanUser(id);
  },
};
