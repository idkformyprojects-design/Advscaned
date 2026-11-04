/**
 * Keeps the local store in step with the Bazaar API when VITE_API_URL is set.
 *
 * Store actions stay synchronous and optimistic (the UI updates instantly); each one
 * also calls into `remote` here, which pushes the change to the server and reconciles
 * the result. `startSync` loads everything on launch and polls for new messages.
 *
 * Ids: the server's id for the signed-in user is mapped to 'me' so every screen keeps
 * working unchanged. A chat's `sellerId` is always the *other* person in the chat.
 */
import {
  api,
  apiEnabled,
  ApiError,
  getToken,
  setToken,
  type RemoteChat,
  type RemoteMe,
} from './api';
import { registerSellers } from './data';
import { toast, useStore } from './store';
import type { Ad, Chat, Message } from './types';

const POLL_MS = 5000;
const REFRESH_MS = 60_000;

let cursor = 0;
let pollTimer: number | undefined;
let lastRefresh = 0;
let started = false;

const active = () => apiEnabled && !!getToken();
const myRemoteId = () => useStore.getState().user?.remoteId;
const local = (id: string) => (id && id === myRemoteId() ? 'me' : id);

function fail(err: unknown, fallback: string) {
  const msg = err instanceof ApiError ? err.message : fallback;
  if (err instanceof ApiError && err.status === 401) {
    useStore.setState({ user: null });
    toast('Your session expired — please sign in again', 'info', {
      label: 'Sign in',
      to: '/login',
    });
    return;
  }
  toast(msg, 'error');
}

/* -------------------------------- mapping -------------------------------- */

const mapAd = (ad: Ad): Ad => ({ ...ad, sellerId: local(ad.sellerId) });

function mapChat(c: RemoteChat, previous?: Chat): Chat {
  return {
    id: c.id,
    adId: c.adId,
    buyerId: 'me',
    sellerId: c.counterpartId,
    lastMessageAt: c.lastMessageAt,
    archived: previous?.archived,
    messages: c.messages.map(
      (m): Message => ({
        id: m.id,
        chatId: m.chatId,
        senderId: local(m.senderId),
        text: m.text,
        kind: m.kind,
        offerAmount: m.offerAmount,
        createdAt: m.createdAt,
        // Own messages count as read locally; incoming ones keep the server's state
        // unless we've already marked them read in this session.
        read:
          local(m.senderId) === 'me' ||
          m.read ||
          !!previous?.messages.find((p) => p.id === m.id)?.read,
      }),
    ),
  };
}

function sessionFrom(me: RemoteMe) {
  return {
    id: 'me',
    remoteId: me.id,
    name: me.name || 'Bazaar user',
    phone: me.phone,
    area: me.area,
    avatarColor: me.avatarColor,
    joined: me.joined,
  };
}

/* ------------------------------- hydration ------------------------------- */

export async function refresh() {
  if (!apiEnabled) return;
  try {
    const data = await api.bootstrap();
    registerSellers(data.sellers);
    lastRefresh = Date.now();
    const state = useStore.getState();
    if (getToken() && !data.me) setToken(null);
    if (data.me) {
      const prev = new Map(state.chats.map((c) => [c.id, c]));
      useStore.setState({
        user: sessionFrom(data.me),
        area: data.me.area,
        ads: data.ads.map((a) => ({
          ...a,
          sellerId: a.sellerId === data.me!.id ? 'me' : a.sellerId,
        })),
        chats: data.chats.map((c) => mapChat(c, prev.get(c.id))),
        favorites: data.favorites,
        notifications: data.notifications,
        reviews: data.reviews,
        blockedSellers: data.blocked,
      });
      cursor = data.now;
    } else {
      useStore.setState({
        ads: data.ads,
        reviews: data.reviews,
        ...(state.user ? { user: null } : {}),
        chats: [],
        favorites: [],
        notifications: [],
        blockedSellers: [],
      });
    }
  } catch (err) {
    // Offline: keep showing the cached store.
    if (!(err instanceof ApiError && err.status === 0))
      console.warn('[bazaar] refresh failed', err);
  }
}

async function poll() {
  if (!active() || (typeof document !== 'undefined' && document.hidden)) return;
  if (Date.now() - lastRefresh > REFRESH_MS) return refresh();
  try {
    const data = await api.updates(cursor);
    cursor = data.now;
    if (!data.chats.length && !data.notifications.length) return;
    registerSellers(data.sellers);
    useStore.setState((s) => {
      const byId = new Map<string, Chat>(s.chats.map((c: Chat) => [c.id, c]));
      for (const c of data.chats) byId.set(c.id, mapChat(c, byId.get(c.id)));
      const known = new Set(s.notifications.map((n) => n.id));
      return {
        chats: [...byId.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt),
        notifications: [...data.notifications.filter((n) => !known.has(n.id)), ...s.notifications],
      };
    });
    const incoming = data.notifications.find((n) => n.type === 'chat' && !n.read);
    if (incoming) browserNotify(incoming.title, incoming.body);
  } catch {
    /* transient — next tick retries */
  }
}

function browserNotify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'bazaar-chat' });
  } catch {
    /* optional */
  }
}

/** Call once at app start. No-op unless VITE_API_URL is configured. */
export function startSync() {
  if (!apiEnabled || started) return;
  started = true;
  void refresh();
  pollTimer = window.setInterval(() => void poll(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void poll();
  });
  window.addEventListener('online', () => void refresh());
}

export function stopSync() {
  window.clearInterval(pollTimer);
  started = false;
}

/** After an OTP sign-in: store the session and load the account's data. */
export async function completeSignIn(token: string, me: RemoteMe) {
  setToken(token);
  registerSellers([]);
  useStore.setState({ user: sessionFrom(me), area: me.area, onboarded: true });
  await refresh();
}

/* ------------------------------ uploads ---------------------------------- */

async function uploadImages(images: string[]): Promise<string[]> {
  return Promise.all(
    images.map(async (src) => (src.startsWith('data:') ? (await api.upload(src)).url : src)),
  );
}

function replaceAd(id: string, ad: Ad) {
  useStore.setState((s) => ({ ads: s.ads.map((a) => (a.id === id ? mapAd(ad) : a)) }));
}

/* --------------------------- pushes from actions -------------------------- */

const pickAdFields = (a: Partial<Ad>) => ({
  title: a.title,
  description: a.description,
  price: a.price,
  category: a.category,
  condition: a.condition,
  area: a.area,
  distanceKm: a.distanceKm,
  negotiable: a.negotiable,
  delivery: a.delivery,
  status: a.status === 'pending' ? undefined : a.status,
  attributes: a.attributes,
});

export const remote = {
  get enabled() {
    return active();
  },

  logout() {
    if (!apiEnabled) return;
    if (getToken()) void api.logout().catch(() => undefined);
    setToken(null);
    void refresh();
  },

  setArea(area: string) {
    if (active()) void api.updateMe({ area }).catch(() => undefined);
  },

  favorite(id: string, on: boolean) {
    if (!active()) return;
    api
      .setFavorite(id, on)
      .then(({ saves }) =>
        useStore.setState((s) => ({ ads: s.ads.map((a) => (a.id === id ? { ...a, saves } : a)) })),
      )
      .catch((e) => fail(e, "Couldn't update favourites"));
  },

  view(id: string) {
    if (apiEnabled) void api.viewAd(id).catch(() => undefined);
  },

  createAd(ad: Ad) {
    if (!active()) return;
    (async () => {
      const images = await uploadImages(ad.images);
      const { ad: saved } = await api.createAd({ id: ad.id, ...pickAdFields(ad), images });
      replaceAd(ad.id, saved);
    })().catch((e) => fail(e, "Couldn't publish your ad — it's saved on this device"));
  },

  updateAd(id: string, patch: Partial<Ad>) {
    if (!active()) return;
    (async () => {
      const fields = pickAdFields(patch);
      const images = patch.images ? await uploadImages(patch.images) : undefined;
      const { ad } = await api.updateAd(id, { ...fields, ...(images ? { images } : {}) });
      replaceAd(id, ad);
    })().catch((e) => fail(e, "Couldn't save your changes"));
  },

  deleteAd(id: string) {
    if (active()) api.deleteAd(id).catch((e) => fail(e, "Couldn't delete the ad"));
  },

  boostAd(id: string) {
    if (!active()) return;
    api
      .boostAd(id)
      .then(({ ad }) => replaceAd(id, ad))
      .catch((e) => fail(e, "Couldn't activate the boost"));
  },

  dropPrice(id: string, price: number) {
    if (!active()) return;
    api
      .updateAd(id, { price })
      .then(({ ad }) => replaceAd(id, ad))
      .catch((e) => fail(e, "Couldn't update the price"));
  },

  startChat(localId: string, adId: string) {
    if (!active()) return;
    api
      .startChat(adId, localId)
      .then(({ chat, seller }) => {
        registerSellers([seller]);
        useStore.setState((s) => ({
          chats: s.chats.map((c) =>
            c.id === localId
              ? {
                  ...mapChat(chat, c),
                  messages: c.messages.length ? c.messages : mapChat(chat).messages,
                }
              : c,
          ),
        }));
      })
      .catch((e) => fail(e, "Couldn't open the conversation"));
  },

  sendMessage(chatId: string, msg: Message) {
    if (!active()) return;
    const chat = useStore.getState().chats.find((c) => c.id === chatId);
    const offerAmount =
      msg.kind === 'offer'
        ? Number(msg.text.match(/₹([\d,]+)/)?.[1]?.replace(/,/g, '')) || undefined
        : undefined;
    const go = () =>
      api.sendMessage(chatId, {
        id: msg.id,
        text: msg.text,
        kind: msg.kind ?? 'text',
        offerAmount,
      });
    // A brand-new chat may still be on its way to the server.
    const ensureChat =
      chat?.messages.length === 1 && chat ? api.startChat(chat.adId, chatId) : null;
    (ensureChat ? ensureChat.then(go) : go())
      .then(() => window.setTimeout(() => void poll(), 2500))
      .catch((e) => fail(e, 'Message not sent — check your connection'));
  },

  markChatRead(chatId: string) {
    if (active()) void api.markChatRead(chatId).catch(() => undefined);
  },

  markNotificationsRead(id?: string) {
    if (active()) void api.markNotificationsRead(id).catch(() => undefined);
  },

  addReview(localId: string, sellerId: string, rating: number, text: string) {
    if (!active()) return;
    api
      .addReview(sellerId, rating, text)
      .then(({ review, seller }) => {
        registerSellers([seller]);
        useStore.setState((s) => ({
          reviews: s.reviews.map((r) => (r.id === localId ? review : r)),
        }));
      })
      .catch((e) => {
        useStore.setState((s) => ({ reviews: s.reviews.filter((r) => r.id !== localId) }));
        fail(e, "Couldn't post your review");
      });
  },

  report(targetType: 'ad' | 'seller', targetId: string, reason: string) {
    if (active()) void api.report(targetType, targetId, reason).catch(() => undefined);
  },

  setBlocked(sellerId: string, on: boolean) {
    if (active())
      api.setBlocked(sellerId, on).catch((e) => fail(e, "Couldn't update the block list"));
  },

  resetDemo() {
    if (apiEnabled) void refresh();
  },
};
