/**
 * Thin client for the Bazaar API (server/). Enabled when the app is built with
 * VITE_API_URL, e.g. `VITE_API_URL=https://bazaar-api.onrender.com npm run build`.
 * Without it the app runs fully offline on its local demo data.
 */
import type { Ad, AppNotification, Review, Seller } from './types';

const RAW_BASE = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const apiEnabled = API_BASE.length > 0;

const TOKEN_KEY = 'bazaar-token';
let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  /* storage unavailable */
}

export const getToken = () => token;
export function setToken(next: string | null) {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach Bazaar right now — check your connection");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/* --------------------------------- shapes --------------------------------- */

export interface RemoteMe {
  id: string;
  name: string;
  phone: string;
  area: string;
  avatarColor: string;
  joined: number;
  role?: 'user' | 'admin';
}
export interface RemoteMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  kind: 'text' | 'offer';
  offerAmount?: number;
  createdAt: number;
  read: boolean;
}
export interface RemoteChat {
  id: string;
  adId: string;
  buyerId: string;
  sellerId: string;
  counterpartId: string;
  messages: RemoteMessage[];
  lastMessageAt: number;
}
export interface Bootstrap {
  now: number;
  me: RemoteMe | null;
  ads: Ad[];
  sellers: Seller[];
  reviews: Review[];
  favorites: string[];
  chats: RemoteChat[];
  notifications: AppNotification[];
  blocked: string[];
  config?: ServerConfig;
}
export interface ServerConfig {
  payments: boolean;
  boostPricePaise: number;
  boostDays: number;
}
export interface BoostOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  description: string;
}
export interface AdminStats {
  users: number;
  liveAds: number;
  underReview: number;
  openReports: number;
  banned: number;
  revenuePaise: number;
}
export interface AdminReport {
  id: string;
  targetType: 'ad' | 'seller';
  targetId: string;
  reason: string;
  createdAt: number;
  status: string;
  resolution?: string | null;
  resolvedAt?: number | null;
  reporterName: string;
  openReportsOnTarget: number;
  target: {
    kind: 'ad' | 'seller';
    missing?: boolean;
    ad?: Ad;
    seller?: Seller & { banned: boolean };
  };
}
export type ResolveAction = 'dismiss' | 'remove' | 'ban' | 'restore';
export interface Updates {
  now: number;
  chats: RemoteChat[];
  notifications: AppNotification[];
  sellers: Seller[];
}

type AdInput = Partial<
  Pick<
    Ad,
    | 'title'
    | 'description'
    | 'price'
    | 'category'
    | 'condition'
    | 'images'
    | 'area'
    | 'distanceKm'
    | 'negotiable'
    | 'delivery'
    | 'status'
    | 'attributes'
  >
> & { id?: string };

/* -------------------------------- endpoints ------------------------------- */

export const api = {
  requestOtp: (phone: string) =>
    request<{ sent: boolean; devCode?: string }>('POST', '/api/auth/otp', { phone }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: RemoteMe; isNew: boolean }>('POST', '/api/auth/verify', {
      phone,
      code,
    }),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout'),
  updateMe: (patch: { name?: string; area?: string }) =>
    request<{ user: RemoteMe }>('PATCH', '/api/me', patch),

  bootstrap: () => request<Bootstrap>('GET', '/api/bootstrap'),
  updates: (since: number) => request<Updates>('GET', `/api/updates?since=${since}`),

  createAd: (ad: AdInput) => request<{ ad: Ad }>('POST', '/api/ads', ad),
  updateAd: (id: string, patch: AdInput) =>
    request<{ ad: Ad }>('PATCH', `/api/ads/${encodeURIComponent(id)}`, patch),
  deleteAd: (id: string) => request<{ ok: true }>('DELETE', `/api/ads/${encodeURIComponent(id)}`),
  boostAd: (id: string) => request<{ ad: Ad }>('POST', `/api/ads/${encodeURIComponent(id)}/boost`),
  viewAd: (id: string) =>
    request<{ views: number }>('POST', `/api/ads/${encodeURIComponent(id)}/view`),
  setFavorite: (id: string, on: boolean) =>
    request<{ saves: number }>(
      on ? 'PUT' : 'DELETE',
      `/api/ads/${encodeURIComponent(id)}/favorite`,
    ),
  upload: (dataUrl: string) => request<{ url: string }>('POST', '/api/uploads', { dataUrl }),

  startChat: (adId: string, id?: string) =>
    request<{ chat: RemoteChat; seller: Seller }>('POST', '/api/chats', { adId, id }),
  sendMessage: (
    chatId: string,
    body: { id: string; text: string; kind?: string; offerAmount?: number },
  ) =>
    request<{ message: RemoteMessage }>(
      'POST',
      `/api/chats/${encodeURIComponent(chatId)}/messages`,
      body,
    ),
  markChatRead: (chatId: string) =>
    request<{ ok: true }>('POST', `/api/chats/${encodeURIComponent(chatId)}/read`),

  addReview: (sellerId: string, rating: number, text: string) =>
    request<{ review: Review; seller: Seller }>(
      'POST',
      `/api/sellers/${encodeURIComponent(sellerId)}/reviews`,
      { rating, text },
    ),
  report: (targetType: 'ad' | 'seller', targetId: string, reason: string) =>
    request<{ ok: true }>('POST', '/api/reports', { targetType, targetId, reason }),
  setBlocked: (sellerId: string, on: boolean) =>
    request<{ blocked: string[] }>(
      on ? 'PUT' : 'DELETE',
      `/api/blocks/${encodeURIComponent(sellerId)}`,
    ),
  markNotificationsRead: (id?: string) =>
    request<{ ok: true }>('POST', '/api/notifications/read', id ? { id } : {}),

  boostOrder: (adId: string) =>
    request<BoostOrder>('POST', `/api/ads/${encodeURIComponent(adId)}/boost/order`),
  verifyPayment: (orderId: string, paymentId: string, signature: string) =>
    request<{ ad: Ad; status: string }>('POST', '/api/payments/verify', {
      orderId,
      paymentId,
      signature,
    }),

  adminStats: () => request<AdminStats>('GET', '/api/admin/stats'),
  adminReports: (status: 'open' | 'resolved' = 'open') =>
    request<{ reports: AdminReport[] }>('GET', `/api/admin/reports?status=${status}`),
  resolveReport: (id: string, action: ResolveAction) =>
    request<{ ok: true }>('POST', `/api/admin/reports/${encodeURIComponent(id)}/resolve`, {
      action,
    }),
  unbanUser: (id: string) =>
    request<{ ok: true }>('POST', `/api/admin/users/${encodeURIComponent(id)}/unban`),
};

/** URL for the live-updates stream (EventSource can't send an Authorization header). */
export const streamUrl = () =>
  token ? `${API_BASE}/api/stream?token=${encodeURIComponent(token)}` : null;
