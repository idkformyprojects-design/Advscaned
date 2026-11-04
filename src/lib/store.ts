import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SEED_ADS,
  SEED_CHATS,
  SEED_NOTIFICATIONS,
  SEED_REVIEWS,
  SEED_SAVED_SEARCHES,
} from './seed';
import type { Ad, AppNotification, Chat, Message, Review, SavedSearch, SessionUser } from './types';
import { sellerById } from './data';
import { uid } from './utils';
import { remote } from './backend';
import type { ServerConfig } from './api';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  action?: { label: string; to?: string };
}

export interface ChatSeed {
  title: string;
  price: number;
  images: string[];
  sellerId: string;
}

interface AppState {
  user: SessionUser | null;
  ads: Ad[];
  chats: Chat[];
  favorites: string[];
  recentlyViewed: { id: string; at: number }[];
  notifications: AppNotification[];
  savedSearches: SavedSearch[];
  reviews: Review[];
  theme: 'light' | 'dark';
  area: string;
  onboarded: boolean;
  installedHintDismissed: boolean;
  blockedSellers: string[];
  /** Settings advertised by the API (payments on/off, boost price). Not persisted. */
  serverConfig: ServerConfig | null;
  reports: {
    id: string;
    targetType: 'ad' | 'seller';
    targetId: string;
    reason: string;
    at: number;
  }[];

  login: (name: string, phone: string, area?: string) => void;
  logout: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setArea: (a: string) => void;
  dismissInstalledHint: () => void;
  completeOnboarding: () => void;

  toggleFavorite: (id: string) => boolean;
  isFavorite: (id: string) => boolean;
  markViewed: (id: string) => void;
  incrementViews: (id: string) => void;

  createAd: (ad: Ad) => void;
  updateAd: (id: string, patch: Partial<Ad>) => void;
  deleteAd: (id: string) => void;
  boostAd: (id: string) => void;
  dropPrice: (id: string, price: number) => void;

  startChat: (adId: string) => string;
  sendMessage: (chatId: string, text: string, kind?: Message['kind']) => void;
  markChatRead: (chatId: string) => void;
  unreadCount: () => number;

  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;

  addReview: (r: Omit<Review, 'id' | 'createdAt'>) => void;
  addSavedSearch: (s: Omit<SavedSearch, 'id' | 'createdAt'>) => void;
  removeSavedSearch: (id: string) => void;
  toggleSearchAlerts: (id: string) => void;

  blockSeller: (sellerId: string) => void;
  unblockSeller: (sellerId: string) => void;
  report: (targetType: 'ad' | 'seller', targetId: string, reason: string) => void;

  resetDemo: () => void;
}

const now = Date.now();

/** Local notification when a chat reply lands while the tab is in the background. */
const notifyBrowser = (title: string, body: string) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    const n = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'bazaar-chat',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notifications are optional */
  }
};

const cannedReplies = [
  'Yes, it is still available. When would you like to see it?',
  'I can do a small discount for a quick pickup. Cash or UPI both work.',
  'Sure — I am free after 6pm today. You can inspect it properly before paying.',
  'Thanks for reaching out! Please share your preferred time and I will keep it ready.',
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      ads: SEED_ADS,
      chats: SEED_CHATS(),
      favorites: ['ad-5', 'ad-7', 'ad-13'],
      recentlyViewed: [
        { id: 'ad-3', at: now - 1000 * 60 * 30 },
        { id: 'ad-1', at: now - 1000 * 60 * 90 },
      ],
      notifications: SEED_NOTIFICATIONS,
      savedSearches: SEED_SAVED_SEARCHES,
      reviews: SEED_REVIEWS,
      theme: 'light',
      area: 'Salt Lake',
      onboarded: false,
      installedHintDismissed: false,
      blockedSellers: [],
      reports: [],
      serverConfig: null,

      login: (name, phone, area) =>
        set((s) => ({
          user: {
            id: 'me',
            name,
            phone,
            area: area ?? s.area,
            avatarColor: '#0AA98C',
            joined: Date.now(),
          },
          area: area ?? s.area,
          onboarded: true,
        })),

      logout: () => {
        set({ user: null });
        remote.logout();
      },

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setArea: (area) => {
        set({ area });
        if (get().user) remote.setArea(area);
      },
      dismissInstalledHint: () => set({ installedHintDismissed: true }),
      completeOnboarding: () => set({ onboarded: true }),

      toggleFavorite: (id) => {
        const has = get().favorites.includes(id);
        set((s) => ({
          favorites: has ? s.favorites.filter((f) => f !== id) : [id, ...s.favorites],
          ads: s.ads.map((a) =>
            a.id === id ? { ...a, saves: Math.max(0, a.saves + (has ? -1 : 1)) } : a,
          ),
        }));
        remote.favorite(id, !has);
        return !has;
      },
      isFavorite: (id) => get().favorites.includes(id),

      markViewed: (id) =>
        set((s) => ({
          recentlyViewed: [
            { id, at: Date.now() },
            ...s.recentlyViewed.filter((r) => r.id !== id),
          ].slice(0, 24),
        })),

      incrementViews: (id) => {
        set((s) => ({
          ads: s.ads.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)),
        }));
        remote.view(id);
      },

      createAd: (ad) => {
        set((s) => ({ ads: [ad, ...s.ads] }));
        remote.createAd(ad);
      },

      updateAd: (id, patch) => {
        set((s) => ({ ads: s.ads.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
        remote.updateAd(id, patch);
      },

      deleteAd: (id) => {
        set((s) => ({ ads: s.ads.filter((a) => a.id !== id) }));
        remote.deleteAd(id);
      },

      boostAd: (id) => {
        if (remote.enabled) {
          // The server records the boost and sends the notification.
          set((s) => ({
            ads: s.ads.map((a) => (a.id === id ? { ...a, boosted: true, featured: true } : a)),
          }));
          remote.boostAd(id);
          return;
        }
        set((s) => ({
          ads: s.ads.map((a) => (a.id === id ? { ...a, boosted: true, featured: true } : a)),
          notifications: [
            {
              id: uid('n'),
              type: 'boost',
              title: 'Boost active · 7 days',
              body: `“${s.ads.find((a) => a.id === id)?.title ?? 'Your ad'}” is now featured at the top of nearby searches.`,
              createdAt: Date.now(),
              read: false,
              href: `/ad/${id}`,
            },
            ...s.notifications,
          ],
        }));
      },

      dropPrice: (id, price) => {
        const before = get().ads.find((a) => a.id === id)?.price;
        set((s) => {
          const ad = s.ads.find((a) => a.id === id);
          if (!ad || price >= ad.price) return s;
          const history = [
            ...(ad.priceHistory ?? [{ price: ad.price, at: ad.createdAt }]),
            { price, at: Date.now() },
          ];
          return {
            ads: s.ads.map((a) => (a.id === id ? { ...a, price, priceHistory: history } : a)),
            notifications: [
              {
                id: uid('n'),
                type: 'price',
                title: 'Price updated',
                body: `“${ad.title}” is now ₹${price.toLocaleString('en-IN')}. Buyers watching it have been notified.`,
                createdAt: Date.now(),
                read: false,
                href: `/ad/${id}`,
              },
              ...s.notifications,
            ],
          };
        });
        if (before !== undefined && price < before) remote.dropPrice(id, price);
      },

      startChat: (adId) => {
        const existing = get().chats.find((c) => c.adId === adId);
        if (existing) return existing.id;
        const ad = get().ads.find((a) => a.id === adId);
        const chat: Chat = {
          // Firebase uses a fixed id per buyer+ad, so reopening finds the same thread.
          id: remote.chatIdFor(adId) ?? uid('chat'),
          adId,
          buyerId: 'me',
          sellerId: ad?.sellerId ?? 'u1',
          messages: [],
          lastMessageAt: Date.now(),
        };
        set((s) => ({ chats: [chat, ...s.chats] }));
        remote.startChat(chat.id, adId);
        return chat.id;
      },

      sendMessage: (chatId, text, kind = 'text') => {
        const msg: Message = {
          id: uid('m'),
          chatId,
          senderId: 'me',
          text,
          createdAt: Date.now(),
          read: true,
          kind,
        };
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, msg], lastMessageAt: Date.now() }
              : c,
          ),
        }));

        if (remote.enabled) {
          remote.sendMessage(chatId, msg);
          return;
        }

        // Offline demo: simulated seller presence.
        const chat = get().chats.find((c) => c.id === chatId);
        if (!chat || get().blockedSellers.includes(chat.sellerId)) return;
        const delay = 1200 + Math.random() * 1400;
        window.setTimeout(() => {
          const seller = sellerById(chat.sellerId);
          const reply: Message = {
            id: uid('m'),
            chatId,
            senderId: chat.sellerId,
            text: cannedReplies[Math.floor(Math.random() * cannedReplies.length)],
            createdAt: Date.now(),
            read: false,
          };
          set((s) => ({
            chats: s.chats.map((c) =>
              c.id === chatId
                ? { ...c, messages: [...c.messages, reply], lastMessageAt: Date.now() }
                : c,
            ),
            notifications: [
              {
                id: uid('n'),
                type: 'chat',
                title: `${seller.name.split(' ')[0]} replied`,
                body: reply.text,
                createdAt: Date.now(),
                read: false,
                href: `/chats/${chatId}`,
              },
              ...s.notifications,
            ],
          }));
          notifyBrowser(`${seller.name.split(' ')[0]} replied on Bazaar`, reply.text);
        }, delay);
      },

      markChatRead: (chatId) => {
        const chat = get().chats.find((c) => c.id === chatId);
        if (chat?.messages.some((m) => m.senderId !== 'me' && !m.read)) remote.markChatRead(chatId);
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) => (m.senderId !== 'me' ? { ...m, read: true } : m)),
                }
              : c,
          ),
        }));
      },

      unreadCount: () =>
        get().chats.reduce(
          (n, c) => n + c.messages.filter((m) => m.senderId !== 'me' && !m.read).length,
          0,
        ),

      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: uid('n'), createdAt: Date.now(), read: false },
            ...s.notifications,
          ],
        })),

      markAllNotificationsRead: () => {
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
        remote.markNotificationsRead();
      },

      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }));
        remote.markNotificationsRead(id);
      },

      addReview: (review) => {
        const id = uid('rv');
        set((s) => ({
          reviews: [{ ...review, id, createdAt: Date.now() }, ...s.reviews],
        }));
        remote.addReview(id, review.sellerId, review.rating, review.text);
      },

      addSavedSearch: (search) =>
        set((s) => ({
          savedSearches: [{ ...search, id: uid('ss'), createdAt: Date.now() }, ...s.savedSearches],
        })),

      removeSavedSearch: (id) =>
        set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),

      toggleSearchAlerts: (id) =>
        set((s) => ({
          savedSearches: s.savedSearches.map((x) =>
            x.id === id ? { ...x, alerts: !x.alerts } : x,
          ),
        })),

      blockSeller: (sellerId) => {
        set((s) => ({
          blockedSellers: s.blockedSellers.includes(sellerId)
            ? s.blockedSellers
            : [...s.blockedSellers, sellerId],
          chats: s.chats.map((c) => (c.sellerId === sellerId ? { ...c, archived: true } : c)),
        }));
        remote.setBlocked(sellerId, true);
      },

      unblockSeller: (sellerId) => {
        set((s) => ({
          blockedSellers: s.blockedSellers.filter((id) => id !== sellerId),
          chats: s.chats.map((c) => (c.sellerId === sellerId ? { ...c, archived: false } : c)),
        }));
        remote.setBlocked(sellerId, false);
      },

      report: (targetType, targetId, reason) => {
        set((s) => ({
          reports: [{ id: uid('rp'), targetType, targetId, reason, at: Date.now() }, ...s.reports],
        }));
        remote.report(targetType, targetId, reason);
      },

      resetDemo: () => {
        if (remote.enabled) {
          // Live data belongs to the server — just reload it.
          remote.resetDemo();
          return;
        }
        set({
          ads: SEED_ADS,
          chats: SEED_CHATS(),
          favorites: ['ad-5', 'ad-7', 'ad-13'],
          notifications: SEED_NOTIFICATIONS,
          savedSearches: SEED_SAVED_SEARCHES,
          reviews: SEED_REVIEWS,
          recentlyViewed: [],
          blockedSellers: [],
          reports: [],
        });
      },
    }),
    {
      name: 'bazaar-store-v1',
      version: 1,
      partialize: (s) => ({
        user: s.user,
        ads: s.ads,
        chats: s.chats,
        favorites: s.favorites,
        recentlyViewed: s.recentlyViewed,
        notifications: s.notifications,
        savedSearches: s.savedSearches,
        reviews: s.reviews,
        theme: s.theme,
        area: s.area,
        onboarded: s.onboarded,
        installedHintDismissed: s.installedHintDismissed,
        blockedSellers: s.blockedSellers,
        reports: s.reports,
      }),
    },
  ),
);

/* ----------------------------- UI (not persisted) ---------------------------- */

interface UIState {
  toasts: Toast[];
  toast: (message: string, kind?: ToastKind, action?: Toast['action']) => void;
  dismiss: (id: string) => void;
}

export const useUI = create<UIState>((set) => ({
  toasts: [],
  toast: (message, kind = 'success', action) => {
    const id = uid('t');
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, action }].slice(-3) }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, kind: ToastKind = 'success', action?: Toast['action']) =>
  useUI.getState().toast(message, kind, action);
